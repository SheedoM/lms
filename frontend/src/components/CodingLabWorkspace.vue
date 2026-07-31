<template>
	<section
		class="coding-lab-workspace"
		aria-label="Coding Lab workspace"
		dir="ltr"
		lang="en"
	>
		<header class="coding-lab-workspace-header">
			<div class="coding-lab-heading min-w-0">
				<strong class="truncate">{{ activeLab.title }}</strong>
				<span class="coding-lab-mode-badge">{{ modeLabel(activeLab) }}</span>
			</div>
			<div class="flex items-center gap-2">
				<select
					v-if="labs.length > 1"
					:value="activeLab.block_id"
					class="coding-lab-switcher"
					aria-label="Switch Coding Lab"
					@change="$emit('switch', $event.target.value)"
				>
					<option
						v-for="lab in labs"
						:key="lab.block_id"
						:value="lab.block_id"
					>
						{{ lab.title }}
					</option>
				</select>
				<button
					v-if="showClose"
					type="button"
					class="coding-lab-button"
					aria-label="Close lab"
					@click="$emit('close')"
				>
					Close
				</button>
			</div>
		</header>

		<div
			v-if="state.starterUpdated"
			class="coding-lab-starter-notice"
			role="status"
		>
			<span>Starter code was updated.</span>
			<button type="button" @click="dismissStarterNotice">Dismiss</button>
		</div>

		<div v-if="activeLab.instructions" class="coding-lab-task-panel">
			<strong>Task</strong>
			<div class="coding-lab-task-copy" v-html="safeInstructions" />
		</div>

		<div class="coding-lab-learner-ide">
			<div class="coding-lab-ide-topbar">
				<div class="coding-lab-tabs" role="tablist">
					<button
						v-for="tab in tabs"
						:key="tab.key"
						type="button"
						role="tab"
						class="coding-lab-button coding-lab-button--tab"
						:class="{ 'is-active': activePane === tab.key }"
						:aria-selected="activePane === tab.key"
						@click="activePane = tab.key"
					>
						{{ tab.label }}
					</button>
				</div>
				<div class="coding-lab-ide-actions">
					<button
						type="button"
						class="coding-lab-button coding-lab-button--primary"
						@click="run"
					>
						Run
					</button>
					<button
						type="button"
						class="coding-lab-button"
						@click="stopRuntime(true)"
					>
						Stop
					</button>
					<button type="button" class="coding-lab-button" @click="reset">
						Reset
					</button>
				</div>
			</div>

			<CodingLabEditor
				v-if="isFilePane"
				:model-value="state.files[activePane] || ''"
				:language="activePane"
				:aria-label="fileLabel(activePane)"
				@update:model-value="updateFile"
			/>
			<div v-show="activePane === 'preview'" class="coding-lab-preview-pane">
				<iframe
					ref="previewFrame"
					class="coding-lab-preview-frame"
					sandbox="allow-scripts"
					title="Coding Lab preview"
				/>
			</div>
			<iframe
				v-if="isJavaScriptOnly"
				ref="hiddenRunFrame"
				class="hidden"
				sandbox="allow-scripts"
				title="JavaScript runtime"
			/>

			<div
				v-if="state.consoleOpen"
				class="coding-lab-console-resizer"
				role="separator"
				aria-orientation="horizontal"
				tabindex="0"
				aria-label="Resize Console"
				@pointerdown="startConsoleResize"
				@keydown="resizeConsoleByKeyboard"
			/>
			<section
				v-if="state.consoleOpen"
				class="coding-lab-learner-console"
				:style="{ height: `${state.consoleHeight}px` }"
			>
				<div class="coding-lab-console-titlebar">
					<strong>{{
						activeLab.lab_kind === 'python' ? 'Terminal' : 'Console'
					}}</strong>
					<button
						type="button"
						class="coding-lab-button coding-lab-button--quiet"
						@click="toggleConsole"
					>
						Hide
					</button>
				</div>
				<pre aria-live="polite">{{ consoleLines.join('\n') }}</pre>
				<form
					v-if="awaitingInput"
					class="coding-lab-stdin"
					@submit.prevent="submitInput"
				>
					<label :for="stdinId">{{ inputPrompt }}</label>
					<input
						:id="stdinId"
						ref="stdinField"
						v-model="inputValue"
						type="text"
						autocomplete="off"
						spellcheck="false"
						aria-label="Python input"
					/>
					<button type="submit">Enter</button>
				</form>
			</section>
			<button
				v-else
				type="button"
				class="coding-lab-console-collapsed"
				@click="toggleConsole"
			>
				{{ activeLab.lab_kind === 'python' ? 'Terminal' : 'Console' }}
			</button>
		</div>
	</section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import CodingLabEditor from '@/components/CodingLabEditor.vue'
import { modeLabel } from '@/utils/codingLab/schema'
import {
	loadLabState,
	resetLabState,
	saveLabState,
} from '@/utils/codingLab/storage'
import {
	buildSandboxDocument,
	isCodingLabMessage,
	pyodideWorkerSource,
} from '@/utils/codingLab/runtime'
import { sanitizeRichHTML } from '@/utils/sanitizeRichHTML'

const props = defineProps({
	labs: { type: Array, required: true },
	activeLab: { type: Object, required: true },
	context: { type: Object, required: true },
	showClose: { type: Boolean, default: true },
	confirmReset: { type: Boolean, default: false },
})
defineEmits(['close', 'switch'])

const previewFrame = ref(null)
const hiddenRunFrame = ref(null)
const stdinField = ref(null)
const activePane = ref('')
const state = ref(createState(props.activeLab))
const consoleLines = ref([])
const awaitingInput = ref(false)
const inputPrompt = ref('')
const inputValue = ref('')
const pythonInputs = ref([])
const states = new Map()
const stdinId = `coding-lab-stdin-${Math.random().toString(36).slice(2)}`
let pythonWorker = null
let pythonWorkerUrl = null
let pythonTimer = null
let channel = createChannel()
let consoleResizeStart = null

const FILE_LABELS = {
	html: 'index.html',
	css: 'style.css',
	javascript: 'script.js',
	python: 'main.py',
}

const isJavaScriptOnly = computed(
	() =>
		props.activeLab.lab_kind === 'web' &&
		props.activeLab.enabled_web_files.length === 1 &&
		props.activeLab.enabled_web_files[0] === 'javascript'
)
const hasPreview = computed(
	() => props.activeLab.lab_kind === 'web' && !isJavaScriptOnly.value
)
const tabs = computed(() => {
	const files =
		props.activeLab.lab_kind === 'python'
			? ['python']
			: props.activeLab.enabled_web_files
	const output = hasPreview.value ? [...files, 'preview'] : files
	return output.map((key) => ({
		key,
		label: key === 'preview' ? 'Preview' : FILE_LABELS[key],
	}))
})
const isFilePane = computed(() => Object.hasOwn(FILE_LABELS, activePane.value))
const safeInstructions = computed(() =>
	sanitizeRichHTML(props.activeLab.instructions || '')
)

function createState(lab) {
	const loaded = loadLabState(
		globalThis.localStorage,
		props.context,
		lab.block_id,
		lab.starter_files,
		lab.starter_revision,
		lab.ui
	)
	return {
		...loaded,
		consoleOpen:
			typeof loaded.consoleOpen === 'boolean'
				? loaded.consoleOpen
				: lab.ui.console_open,
		consoleHeight: clampConsole(
			loaded.consoleHeight ?? lab.ui.console_height
		),
	}
}

function updateFile(value) {
	if (!isFilePane.value) return
	state.value.files[activePane.value] = value
	persist()
}

function persist() {
	const snapshot = snapshotState()
	states.set(stateKey(props.activeLab), snapshot)
	saveLabState(
		globalThis.localStorage,
		props.context,
		props.activeLab.block_id,
		snapshot
	)
}

function snapshotState() {
	return {
		files: { ...state.value.files },
		starterRevision: props.activeLab.starter_revision,
		starterUpdated: state.value.starterUpdated,
		consoleOpen: state.value.consoleOpen,
		consoleHeight: state.value.consoleHeight,
	}
}

function dismissStarterNotice() {
	state.value.starterUpdated = false
	persist()
}

function reset() {
	if (
		props.confirmReset &&
		!window.confirm('Reset this workspace and discard the current draft?')
	)
		return
	stopRuntime()
	state.value = resetLabState(
		globalThis.localStorage,
		props.context,
		props.activeLab.block_id,
		props.activeLab.starter_files,
		props.activeLab.starter_revision
	)
	state.value.consoleOpen = props.activeLab.ui.console_open
	state.value.consoleHeight = props.activeLab.ui.console_height
	consoleLines.value = []
	if (activePane.value === 'preview') nextTick(runWeb)
}

function run() {
	consoleLines.value = []
	state.value.consoleOpen = true
	persist()
	if (props.activeLab.lab_kind === 'python') runPython()
	else runWeb()
}

function runWeb() {
	const target = isJavaScriptOnly.value
		? hiddenRunFrame.value
		: previewFrame.value
	if (!target) return
	if (hasPreview.value) activePane.value = 'preview'
	channel = createChannel()
	target.srcdoc = buildSandboxDocument({
		html: props.activeLab.enabled_web_files.includes('html')
			? state.value.files.html
			: '',
		css: props.activeLab.enabled_web_files.includes('css')
			? state.value.files.css
			: '',
		javascript: props.activeLab.enabled_web_files.includes('javascript')
			? state.value.files.javascript
			: '',
		channel,
	})
}

function stopWeb(showMessage = false) {
	const target = isJavaScriptOnly.value
		? hiddenRunFrame.value
		: previewFrame.value
	channel = createChannel()
	if (target) target.srcdoc = '<!doctype html><html><body></body></html>'
	if (showMessage) consoleLines.value.push('Execution stopped.')
}

function stopRuntime(showMessage = false) {
	if (props.activeLab.lab_kind === 'python') stopPython(showMessage)
	else stopWeb(showMessage)
}

function createPythonWorker() {
	pythonWorkerUrl = URL.createObjectURL(
		new Blob([pyodideWorkerSource()], { type: 'text/javascript' })
	)
	pythonWorker = new Worker(pythonWorkerUrl)
	pythonWorker.onmessage = handlePythonMessage
}

function runPython() {
	stopPython()
	pythonInputs.value = []
	awaitingInput.value = false
	inputValue.value = ''
	consoleLines.value = ['Starting Python…']
	createPythonWorker()
	runPythonAttempt()
}

function runPythonAttempt() {
	if (!pythonWorker) return
	clearTimeout(pythonTimer)
	pythonTimer = setTimeout(() => {
		stopRuntime()
		appendError('Execution timeout: possible infinite loop.')
	}, 20000)
	pythonWorker.postMessage({
		code: state.value.files.python,
		inputs: [...pythonInputs.value],
	})
}

function handlePythonMessage({ data }) {
	if (data.type === 'status') {
		consoleLines.value = [data.message]
		return
	}
	clearTimeout(pythonTimer)
	consoleLines.value = []
	if (data.stdout) consoleLines.value.push(data.stdout.trimEnd())
	if (data.stderr) appendError(data.stderr)
	if (data.type === 'input-request') {
		awaitingInput.value = true
		inputPrompt.value = data.prompt || ''
		inputValue.value = ''
		nextTick(() => stdinField.value?.focus())
		return
	}
	awaitingInput.value = false
	if (data.type === 'error') appendError(data.message)
	else if (!data.stdout && !data.stderr)
		consoleLines.value.push('Code ran successfully with no output.')
}

function submitInput() {
	if (!awaitingInput.value || !pythonWorker) return
	pythonInputs.value.push(inputValue.value)
	awaitingInput.value = false
	runPythonAttempt()
}

function stopPython(showMessage = false) {
	pythonWorker?.terminate()
	pythonWorker = null
	if (pythonWorkerUrl) URL.revokeObjectURL(pythonWorkerUrl)
	pythonWorkerUrl = null
	clearTimeout(pythonTimer)
	awaitingInput.value = false
	if (showMessage) consoleLines.value.push('Execution stopped.')
}

function onRuntimeMessage(event) {
	const frame = isJavaScriptOnly.value
		? hiddenRunFrame.value
		: previewFrame.value
	if (!isCodingLabMessage(event, frame?.contentWindow, channel)) return
	const data = event.data
	if (data.type === 'console')
		consoleLines.value.push(`[${data.level}] ${data.args.join(' ')}`)
	else if (data.type === 'runtime-error') appendError(data.message)
}

function appendError(error) {
	consoleLines.value.push(String(error?.message || error || 'Unknown runtime error'))
}

function toggleConsole() {
	state.value.consoleOpen = !state.value.consoleOpen
	persist()
}

function startConsoleResize(event) {
	consoleResizeStart = {
		y: event.clientY,
		height: state.value.consoleHeight,
	}
	window.addEventListener('pointermove', resizeConsole)
	window.addEventListener('pointerup', stopConsoleResize, { once: true })
}

function resizeConsole(event) {
	if (!consoleResizeStart) return
	state.value.consoleHeight = clampConsole(
		consoleResizeStart.height + consoleResizeStart.y - event.clientY
	)
}

function stopConsoleResize() {
	consoleResizeStart = null
	window.removeEventListener('pointermove', resizeConsole)
	persist()
}

function resizeConsoleByKeyboard(event) {
	if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
	event.preventDefault()
	state.value.consoleHeight = clampConsole(
		state.value.consoleHeight + (event.key === 'ArrowUp' ? 20 : -20)
	)
	persist()
}

function clampConsole(value) {
	return Math.min(420, Math.max(100, Number(value) || 180))
}

function fileLabel(file) {
	return FILE_LABELS[file] || file
}

function createChannel() {
	return `coding-lab-run-${Math.random().toString(36).slice(2)}`
}

function stateKey(lab) {
	return `${lab.block_id}:${lab.starter_revision}`
}

watch(
	() => [props.activeLab.block_id, props.activeLab.starter_revision],
	([blockId], [oldBlockId, oldRevision] = []) => {
		if (oldBlockId) {
			const previous = {
				files: { ...state.value.files },
				starterRevision: oldRevision,
				starterUpdated: state.value.starterUpdated,
				consoleOpen: state.value.consoleOpen,
				consoleHeight: state.value.consoleHeight,
			}
			states.set(`${oldBlockId}:${oldRevision}`, previous)
			saveLabState(
				globalThis.localStorage,
				props.context,
				oldBlockId,
				previous
			)
		}
		stopRuntime()
		const remembered = states.get(stateKey(props.activeLab))
		state.value = remembered
			? { ...remembered, files: { ...remembered.files } }
			: createState(props.activeLab)
		const requested = props.activeLab.ui.default_file
		const available = tabs.value.map((tab) => tab.key)
		activePane.value = available.includes(requested)
			? requested
			: available[0]
		consoleLines.value = []
	},
	{ immediate: true }
)

window.addEventListener('message', onRuntimeMessage)
onBeforeUnmount(() => {
	persist()
	stopRuntime()
	stopConsoleResize()
	window.removeEventListener('message', onRuntimeMessage)
})
</script>
