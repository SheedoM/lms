import { createApp, h } from 'vue'
import { Code2 } from 'lucide-vue-next'
import {
	createCodingLab,
	instructionsSummary,
	modeLabel,
	normalizeCodingLab,
	serializeCodingLab,
	WEB_FILE_KEYS,
} from './schema'
import {
	buildSandboxDocument,
	isCodingLabMessage,
	pyodideWorkerSource,
} from './runtime'
import { formatRuntimeError } from './errorHelp'

const FILE_LABELS = {
	html: 'index.html',
	css: 'style.css',
	javascript: 'script.js',
	python: 'main.py',
}

export class CodingLab {
	constructor({ data, readOnly, block, config = {} }) {
		this.block = block
		this.blockId = data?.block_id || block?.id
		this.data = Object.keys(data || {}).length
			? serializeCodingLab(data, this.blockId)
			: {}
		this.draft = Object.keys(this.data).length
			? serializeCodingLab(this.data, this.blockId)
			: null
		this.readOnly = readOnly
		this.authorPreview = Boolean(config.authorPreview)
		this.saving = false
		this.channel = `coding-lab-${Math.random().toString(36).slice(2)}`
		this.wrapper = document.createElement('div')
		this.wrapper.className = 'coding-lab-block'
		this.handleMessage = this.handleMessage.bind(this)
		window.addEventListener('message', this.handleMessage)
	}

	static get isReadOnlySupported() {
		return true
	}

	static get sanitize() {
		return {
			schema_version: false,
			block_id: false,
			title: false,
			instructions: false,
			task: false,
			lab_kind: false,
			lab_type: false,
			enabled_web_files: false,
			starter_files: false,
			starter_code: false,
			test_code: false,
			local_test_code: false,
			ui: false,
			coding_lab: false,
		}
	}

	static get toolbox() {
		const host = document.createElement('span')
		createApp({ render: () => h(Code2, { size: 18, strokeWidth: 1.5 }) }).mount(
			host
		)
		return { title: __('Coding Lab'), icon: host.innerHTML }
	}

	render() {
		if (this.readOnly) this.renderLauncher()
		else if (this.draft) this.renderAuthoring()
		else this.renderKindPicker()
		return this.wrapper
	}

	renderKindPicker() {
		this.wrapper.replaceChildren()
		const card = this.element('div', 'coding-lab-kind-picker')
		card.append(
			this.element('strong', '', __('Choose a Coding Lab')),
			this.element(
				'p',
				'coding-lab-muted',
				__('Start with a Web or Python workspace.')
			)
		)
		const actions = this.element('div', 'coding-lab-kind-actions')
		for (const [kind, label, help] of [
			['web', __('Web'), __('HTML, CSS and JavaScript')],
			['python', __('Python'), __('Python code and local tests')],
		]) {
			const button = this.element('button', 'coding-lab-kind-button')
			button.type = 'button'
			button.append(
				this.element('strong', '', label),
				this.element('span', '', help)
			)
			button.addEventListener('click', () => {
				this.draft = createCodingLab(kind, this.blockId)
				this.data = serializeCodingLab(this.draft, this.blockId)
				this.blockId = this.data.block_id
				this.block?.dispatchChange?.()
				this.renderAuthoring()
			})
			actions.append(button)
		}
		card.append(actions)
		this.wrapper.append(card)
	}

	renderAuthoring() {
		this.stopPython()
		this.wrapper.replaceChildren()
		const header = this.element('div', 'coding-lab-author-header')
		const heading = this.element('div', 'coding-lab-heading')
		heading.append(
			this.element('strong', '', __('Coding Lab')),
			this.element('span', 'coding-lab-mode-badge', modeLabel(this.draft))
		)
		header.append(heading)
		this.wrapper.append(header)

		const terminal = this.element('div', 'coding-lab-author-terminal')
		const taskGrid = this.element('div', 'coding-lab-author-task-grid')
		taskGrid.append(
			this.field(__('Title'), 'title', this.draft.title),
			this.field(
				__('Task / instructions'),
				'instructions',
				this.draft.instructions,
				true
			)
		)
		terminal.append(taskGrid)

		if (this.draft.lab_kind === 'web') {
			terminal.append(this.renderWebFilePicker())
		}
		terminal.append(this.renderIde())
		this.wrapper.append(terminal)

		const footer = this.element('div', 'coding-lab-author-footer')
		const save = this.button(__('Save IDE'), 'primary')
		save.dataset.role = 'save-ide'
		save.addEventListener('click', () => this.saveIde())
		const status = this.element('span', 'coding-lab-save-status')
		status.dataset.role = 'save-status'
		status.setAttribute('aria-live', 'polite')
		footer.append(save, status)
		this.wrapper.append(footer)
	}

	renderWebFilePicker() {
		const wrapper = this.element('fieldset', 'coding-lab-web-files')
		const legend = this.element('legend', '', __('Files'))
		wrapper.append(legend)
		WEB_FILE_KEYS.forEach((file) => {
			const label = this.element('label', 'coding-lab-file-check')
			const input = document.createElement('input')
			input.type = 'checkbox'
			input.value = file
			input.checked = this.draft.enabled_web_files.includes(file)
			input.dataset.webFile = file
			input.addEventListener('change', () => {
				const checked = this.wrapper.querySelectorAll(
					'[data-web-file]:checked'
				)
				if (!checked.length) {
					input.checked = true
					return
				}
				this.syncDraftFromFields()
				this.renderAuthoring()
				this.setStatus(__('Unsaved changes'), 'dirty')
			})
			label.append(input, FILE_LABELS[file])
			wrapper.append(label)
		})
		return wrapper
	}

	renderIde() {
		const ide = this.element('div', 'coding-lab-ide')
		const topbar = this.element('div', 'coding-lab-ide-topbar')
		const tabs = this.element('div', 'coding-lab-tabs')
		const files =
			this.draft.lab_kind === 'python'
				? ['python']
				: this.draft.enabled_web_files
		const active = files.includes(this.draft.ui.default_file)
			? this.draft.ui.default_file
			: files[0]
		this.draft.ui.default_file = active
		files.forEach((file) => {
			const tab = this.button(FILE_LABELS[file], 'tab')
			tab.classList.toggle('is-active', file === active)
			tab.dataset.tab = file
			tab.addEventListener('click', () => this.switchTab(file))
			tabs.append(tab)
		})
		const actions = this.element('div', 'coding-lab-ide-actions')
		const run = this.button(__('Run'))
		run.addEventListener('click', () => this.run(false))
		const check = this.button(__('Check Solution'))
		check.addEventListener('click', () => this.run(true))
		actions.append(run, check)
		if (this.draft.lab_kind === 'python') {
			const stop = this.button(__('Stop'))
			stop.addEventListener('click', () => this.stopPython(true))
			actions.append(stop)
		}
		topbar.append(tabs, actions)
		ide.append(topbar)

		files.forEach((file) => {
			const editor = document.createElement('textarea')
			editor.className = 'coding-lab-code-editor'
			editor.classList.toggle('is-active', file === active)
			editor.dataset.codeFile = file
			editor.value = this.draft.starter_files[file] || ''
			editor.spellcheck = false
			editor.setAttribute('aria-label', FILE_LABELS[file])
			editor.addEventListener('input', () =>
				this.setStatus(__('Unsaved changes'), 'dirty')
			)
			ide.append(editor)
		})

		const tests = this.field(
			__('Local tests (optional)'),
			'test_code',
			this.draft.test_code,
			true,
			true
		)
		tests.classList.add('coding-lab-tests-editor')
		ide.append(tests)
		const output = this.element('div', 'coding-lab-console')
		output.dataset.role = 'console'
		output.append(
			this.element('strong', 'coding-lab-console-title', __('Console / Tests'))
		)
		const pre = document.createElement('pre')
		pre.dataset.role = 'console-output'
		pre.setAttribute('aria-live', 'polite')
		output.append(pre)
		ide.append(output)

		if (this.draft.lab_kind === 'web') {
			const preview = document.createElement('iframe')
			preview.className = 'coding-lab-author-preview'
			preview.dataset.role = 'preview'
			preview.sandbox = 'allow-scripts'
			preview.title = __('Coding Lab preview')
			ide.append(preview)
		}
		return ide
	}

	field(labelText, name, value, multiline = false, code = false) {
		const label = this.element('label', 'coding-lab-terminal-field')
		label.append(this.element('span', '', labelText))
		const input = multiline
			? document.createElement('textarea')
			: document.createElement('input')
		input.dataset.field = name
		input.value = value || ''
		input.spellcheck = !code
		if (code) input.classList.add('is-code')
		input.addEventListener('input', () =>
			this.setStatus(__('Unsaved changes'), 'dirty')
		)
		label.append(input)
		return label
	}

	syncDraftFromFields() {
		if (!this.draft) return
		const value = (selector) =>
			this.wrapper.querySelector(selector)?.value ?? ''
		this.draft.title = value('[data-field="title"]') || __('Untitled Coding Lab')
		this.draft.instructions = value('[data-field="instructions"]')
		this.draft.test_code = value('[data-field="test_code"]')
		this.wrapper.querySelectorAll('[data-code-file]').forEach((editor) => {
			this.draft.starter_files[editor.dataset.codeFile] = editor.value
		})
		if (this.draft.lab_kind === 'web') {
			this.draft.enabled_web_files = Array.from(
				this.wrapper.querySelectorAll('[data-web-file]:checked')
			).map((input) => input.value)
		}
	}

	switchTab(file) {
		this.draft.ui.default_file = file
		this.wrapper.querySelectorAll('[data-tab]').forEach((tab) => {
			tab.classList.toggle('is-active', tab.dataset.tab === file)
		})
		this.wrapper.querySelectorAll('[data-code-file]').forEach((editor) => {
			editor.classList.toggle('is-active', editor.dataset.codeFile === file)
		})
	}

	requestLessonSave(commit) {
		return new Promise((resolve, reject) => {
			const detail = {
				blockId: this.blockId,
				handled: false,
				commit,
				resolve,
				reject,
			}
			this.wrapper.dispatchEvent(
				new CustomEvent('lms:coding-lab-save-request', {
					bubbles: true,
					composed: true,
					detail,
				})
			)
			if (!detail.handled)
				reject(new Error(__('Course Lesson save handler is unavailable.')))
		})
	}

	async saveIde() {
		if (!this.draft || this.saving) return
		this.saving = true
		const button = this.wrapper.querySelector('[data-role="save-ide"]')
		if (button) button.disabled = true
		this.setStatus(__('Saving…'), 'saving')
		const previous = this.data
		try {
			this.syncDraftFromFields()
			const next = serializeCodingLab(this.draft, this.blockId)
			await this.requestLessonSave(() => {
				this.data = next
				this.block?.dispatchChange?.()
			})
			this.setStatus(__('Saved'), 'saved')
		} catch (error) {
			this.data = previous
			console.error('[Coding Lab] Save IDE failed', error)
			this.setStatus(__('Error saving IDE'), 'error')
		} finally {
			this.saving = false
			if (button) button.disabled = false
		}
	}

	setStatus(message, state) {
		const status = this.wrapper.querySelector('[data-role="save-status"]')
		if (!status) return
		status.textContent = message
		status.dataset.state = state
	}

	run(runTests) {
		this.syncDraftFromFields()
		this.clearOutput()
		if (this.draft.lab_kind === 'python') this.runPython(runTests)
		else this.runWeb(runTests)
	}

	runWeb(runTests) {
		const frame = this.wrapper.querySelector('[data-role="preview"]')
		if (!frame) return
		const files = this.draft.starter_files
		frame.srcdoc = buildSandboxDocument({
			html: this.draft.enabled_web_files.includes('html') ? files.html : '',
			css: this.draft.enabled_web_files.includes('css') ? files.css : '',
			javascript: this.draft.enabled_web_files.includes('javascript')
				? files.javascript
				: '',
			tests: this.draft.test_code,
			runTests,
			channel: this.channel,
		})
	}

	runPython(runTests) {
		this.stopPython()
		const url = URL.createObjectURL(
			new Blob([pyodideWorkerSource()], { type: 'text/javascript' })
		)
		this.pythonWorkerUrl = url
		this.pythonWorker = new Worker(url)
		this.appendOutput(__('Starting Python…'))
		this.pythonWorker.onmessage = ({ data }) => {
			if (data.type === 'status') {
				this.clearOutput()
				this.appendOutput(__(data.message))
				return
			}
			clearTimeout(this.pythonTimer)
			if (data.type === 'error') this.appendError(data.message)
			else {
				this.clearOutput()
				if (data.stdout) this.appendOutput(data.stdout.trimEnd())
				if (data.stderr) this.appendError(data.stderr)
				if (runTests) this.appendTestResults(data.results || [])
				if (!data.stdout && !data.stderr && !runTests)
					this.appendOutput(__('Code ran successfully with no output.'))
			}
		}
		this.pythonTimer = setTimeout(() => {
			this.stopPython()
			this.appendError('Execution timeout: possible infinite loop.')
		}, 20000)
		this.pythonWorker.postMessage({
			code: this.draft.starter_files.python,
			tests: this.draft.test_code,
			runTests,
		})
	}

	stopPython(showMessage = false) {
		this.pythonWorker?.terminate()
		this.pythonWorker = null
		if (this.pythonWorkerUrl) URL.revokeObjectURL(this.pythonWorkerUrl)
		this.pythonWorkerUrl = null
		clearTimeout(this.pythonTimer)
		if (showMessage) this.appendOutput(__('Execution stopped.'))
	}

	handleMessage(event) {
		const frame = this.wrapper.querySelector('[data-role="preview"]')
		if (!isCodingLabMessage(event, frame?.contentWindow, this.channel)) return
		const data = event.data
		if (data.type === 'console')
			this.appendOutput(`[${data.level}] ${data.args.join(' ')}`)
		else if (data.type === 'runtime-error') this.appendError(data.message)
		else if (data.type === 'tests') this.appendTestResults(data.results)
	}

	clearOutput() {
		const output = this.wrapper.querySelector('[data-role="console-output"]')
		if (output) output.textContent = ''
	}

	appendOutput(message) {
		const output = this.wrapper.querySelector('[data-role="console-output"]')
		if (output) output.textContent += `${message}\n`
	}

	appendError(error) {
		const formatted = formatRuntimeError(error)
		this.appendOutput(formatted.original)
		if (formatted.hint) this.appendOutput(formatted.hint)
	}

	appendTestResults(results) {
		if (!results?.length) {
			this.appendOutput(__('No tests were defined.'))
			return
		}
		results.forEach((result) =>
			this.appendOutput(
				`${result.passed ? '✓' : '✕'} ${result.name}${
					result.message ? ` — ${result.message}` : ''
				}`
			)
		)
	}

	renderLauncher() {
		this.wrapper.replaceChildren()
		if (!Object.keys(this.data).length) {
			this.wrapper.append(__('This Coding Lab is unavailable.'))
			return
		}
		const lab = normalizeCodingLab(this.data, this.blockId)
		const card = this.element('section', 'coding-lab-practice-card')
		const content = this.element('div', 'coding-lab-practice-content')
		const eyebrow = this.element('span', 'coding-lab-practice-eyebrow', __('Practice'))
		const heading = this.element('div', 'coding-lab-heading')
		heading.append(
			this.element('h3', '', lab.title),
			this.element('span', 'coding-lab-mode-badge', modeLabel(lab))
		)
		content.append(eyebrow, heading)
		const summary = instructionsSummary(lab.instructions)
		if (summary)
			content.append(this.element('p', 'coding-lab-muted', summary))
		const open = this.button(__('Open lab'), 'primary')
		open.addEventListener('click', () => {
			window.dispatchEvent(
				new CustomEvent('lms:coding-lab-open', {
					detail: { lab, authorPreview: this.authorPreview },
				})
			)
		})
		card.append(content, open)
		this.wrapper.append(card)
	}

	element(tag, className = '', text = '') {
		const element = document.createElement(tag)
		if (className) element.className = className
		if (text) element.textContent = text
		return element
	}

	button(label, variant = 'secondary') {
		const button = this.element(
			'button',
			`coding-lab-button coding-lab-button--${variant}`,
			label
		)
		button.type = 'button'
		return button
	}

	save() {
		return this.data
	}

	destroy() {
		this.stopPython()
		window.removeEventListener('message', this.handleMessage)
	}
}

export class LegacyCodingLab extends CodingLab {
	static get toolbox() {
		return false
	}
}
