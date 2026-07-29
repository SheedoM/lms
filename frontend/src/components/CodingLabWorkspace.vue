<template>
	<section class="coding-lab-workspace" :aria-label="__('Coding Lab workspace')">
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
					:aria-label="__('Switch Coding Lab')"
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
					type="button"
					class="coding-lab-button"
					:aria-label="__('Close lab')"
					@click="$emit('close')"
				>
					{{ __('Close') }}
				</button>
			</div>
		</header>

		<div class="coding-lab-task-panel">
			<strong>{{ __('Task') }}</strong>
			<div
				v-if="activeLab.instructions"
				class="coding-lab-task-copy"
				v-html="safeInstructions"
			/>
			<p v-else class="coding-lab-muted">{{ __('No task instructions.') }}</p>
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
					<button type="button" class="coding-lab-button" @click="run(false)">
						{{ __('Run') }}
					</button>
					<button
						type="button"
						class="coding-lab-button"
						@click="checkSolution"
					>
						{{ __('Check Solution') }}
					</button>
					<button
						v-if="activeLab.lab_kind === 'python'"
						type="button"
						class="coding-lab-button"
						@click="stopPython(true)"
					>
						{{ __('Stop') }}
					</button>
					<button type="button" class="coding-lab-button" @click="reset">
						{{ __('Reset') }}
					</button>
				</div>
			</div>

			<textarea
				v-if="isFilePane"
				v-model="state.files[activePane]"
				class="coding-lab-code-editor is-active coding-lab-learner-editor"
				:aria-label="fileLabel(activePane)"
				:spellcheck="false"
				@input="persist"
			/>
			<div
				v-show="activePane === 'preview'"
				class="coding-lab-preview-pane"
			>
				<iframe
					ref="previewFrame"
					class="coding-lab-preview-frame"
					sandbox="allow-scripts"
					:title="__('Coding Lab preview')"
				/>
			</div>
			<div
				v-if="activePane === 'tests'"
				class="coding-lab-test-pane"
				:aria-label="__('Test results')"
			>
				<strong>{{ __('Tests') }}</strong>
				<p v-if="!testResults.length" class="coding-lab-muted">
					{{ __('Run Check Solution to see local test results.') }}
				</p>
				<ul v-else class="coding-lab-test-results">
					<li
						v-for="(result, index) in testResults"
						:key="`${result.name}-${index}`"
						:class="result.passed ? 'is-passed' : 'is-failed'"
					>
						<span aria-hidden="true">{{ result.passed ? '✓' : '✕' }}</span>
						<span>{{ result.name }}</span>
						<small v-if="result.message">{{ result.message }}</small>
					</li>
				</ul>
			</div>

			<div
				v-if="state.consoleOpen"
				class="coding-lab-console-resizer"
				role="separator"
				aria-orientation="horizontal"
				tabindex="0"
				:aria-label="__('Resize Console')"
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
						activeLab.lab_kind === 'python'
							? __('Terminal')
							: __('Console')
					}}</strong>
					<button
						type="button"
						class="coding-lab-button coding-lab-button--quiet"
						@click="toggleConsole"
					>
						{{ __('Hide') }}
					</button>
				</div>
				<pre aria-live="polite">{{ consoleLines.join('\n') }}</pre>
			</section>
			<button
				v-else
				type="button"
				class="coding-lab-console-collapsed"
				@click="toggleConsole"
			>
				{{ activeLab.lab_kind === 'python' ? __('Terminal') : __('Console') }}
			</button>
		</div>
	</section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
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
import { formatRuntimeError } from '@/utils/codingLab/errorHelp'
import { sanitizeRichHTML } from '@/utils/sanitizeRichHTML'

const props = defineProps({
	labs: { type: Array, required: true },
	activeLab: { type: Object, required: true },
	context: { type: Object, required: true },
})
defineEmits(['close', 'switch'])

const previewFrame = ref(null)
const activePane = ref('')
const state = ref(createState(props.activeLab))
const consoleLines = ref([])
const testResults = ref([])
const states = new Map()
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

const tabs = computed(() => {
	const files =
		props.activeLab.lab_kind === 'python'
			? ['python']
			: props.activeLab.enabled_web_files
	const output =
		props.activeLab.lab_kind === 'web'
			? [...files, 'preview', 'tests']
			: [...files, 'tests']
	return output.map((key) => ({
		key,
		label:
			key === 'preview'
				? __('Preview')
				: key === 'tests'
					? __('Tests')
					: FILE_LABELS[key],
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
		lab.starter_files
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

function persist() {
	states.set(props.activeLab.block_id, snapshotState())
	saveLabState(
		globalThis.localStorage,
		props.context,
		props.activeLab.block_id,
		snapshotState()
	)
}

function snapshotState() {
	return {
		files: { ...state.value.files },
		consoleOpen: state.value.consoleOpen,
		consoleHeight: state.value.consoleHeight,
	}
}

function reset() {
	stopPython()
	state.value = resetLabState(
		globalThis.localStorage,
		props.context,
		props.activeLab.block_id,
		props.activeLab.starter_files
	)
	state.value.consoleOpen = props.activeLab.ui.console_open
	state.value.consoleHeight = props.activeLab.ui.console_height
	consoleLines.value = []
	testResults.value = []
	if (activePane.value === 'preview') nextTick(() => run(false))
}

function run(runTests) {
	consoleLines.value = []
	if (runTests) testResults.value = []
	state.value.consoleOpen = true
	persist()
	if (props.activeLab.lab_kind === 'python') runPython(runTests)
	else runWeb(runTests)
}

function checkSolution() {
	activePane.value = 'tests'
	run(true)
}

function runWeb(runTests) {
	const frame = previewFrame.value
	activePane.value = runTests ? 'tests' : 'preview'
	nextTick(() => {
		const target = previewFrame.value || frame
		if (!target) return
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
			tests: props.activeLab.test_code,
			runTests,
			channel,
		})
	})
}

function runPython(runTests) {
	stopPython()
	state.value.consoleOpen = true
	consoleLines.value = [__('Starting Python…')]
	pythonWorkerUrl = URL.createObjectURL(
		new Blob([pyodideWorkerSource()], { type: 'text/javascript' })
	)
	pythonWorker = new Worker(pythonWorkerUrl)
	pythonWorker.onmessage = ({ data }) => {
		if (data.type === 'status') {
			consoleLines.value = [__(data.message)]
			return
		}
		clearTimeout(pythonTimer)
		consoleLines.value = []
		if (data.type === 'error') appendError(data.message)
		else {
			if (data.stdout) consoleLines.value.push(data.stdout.trimEnd())
			if (data.stderr) appendError(data.stderr)
			if (runTests) testResults.value = data.results || []
			if (!data.stdout && !data.stderr && !runTests)
				consoleLines.value.push(__('Code ran successfully with no output.'))
		}
	}
	pythonTimer = setTimeout(() => {
		stopPython()
		appendError('Execution timeout: possible infinite loop.')
	}, 20000)
	pythonWorker.postMessage({
		code: state.value.files.python,
		tests: props.activeLab.test_code,
		runTests,
	})
}

function stopPython(showMessage = false) {
	pythonWorker?.terminate()
	pythonWorker = null
	if (pythonWorkerUrl) URL.revokeObjectURL(pythonWorkerUrl)
	pythonWorkerUrl = null
	clearTimeout(pythonTimer)
	if (showMessage) consoleLines.value.push(__('Execution stopped.'))
}

function onRuntimeMessage(event) {
	if (
		!isCodingLabMessage(
			event,
			previewFrame.value?.contentWindow,
			channel
		)
	)
		return
	const data = event.data
	if (data.type === 'console')
		consoleLines.value.push(`[${data.level}] ${data.args.join(' ')}`)
	else if (data.type === 'runtime-error') appendError(data.message)
	else if (data.type === 'tests') testResults.value = data.results || []
}

function appendError(error) {
	const formatted = formatRuntimeError(error)
	consoleLines.value.push(formatted.original)
	if (formatted.hint) consoleLines.value.push(formatted.hint)
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

watch(
	() => props.activeLab.block_id,
	(blockId, oldBlockId) => {
		if (oldBlockId) {
			const previous = snapshotState()
			states.set(oldBlockId, previous)
			saveLabState(
				globalThis.localStorage,
				props.context,
				oldBlockId,
				previous
			)
		}
		stopPython()
		const remembered = states.get(blockId)
		state.value = remembered
			? { ...remembered, files: { ...remembered.files } }
			: createState(props.activeLab)
		activePane.value =
			props.activeLab.lab_kind === 'python'
				? 'python'
				: props.activeLab.ui.default_file
		consoleLines.value = []
		testResults.value = []
	},
	{ immediate: true }
)

window.addEventListener('message', onRuntimeMessage)
onBeforeUnmount(() => {
	persist()
	stopPython()
	stopConsoleResize()
	window.removeEventListener('message', onRuntimeMessage)
})
</script>
