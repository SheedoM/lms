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
import { createCodingLabAceEditor } from './aceEditor'

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
		this.wrapper.dir = 'ltr'
		this.wrapper.lang = 'en'
		this.codeEditors = new Map()
		this.pythonInputs = []
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
			starter_revision: false,
			title: false,
			instructions: false,
			task: false,
			lab_kind: false,
			lab_type: false,
			enabled_web_files: false,
			starter_files: false,
			starter_code: false,
			ui: false,
			coding_lab: false,
		}
	}

	static get toolbox() {
		const host = document.createElement('span')
		createApp({ render: () => h(Code2, { size: 18, strokeWidth: 1.5 }) }).mount(
			host
		)
		return { title: 'Coding Lab', icon: host.innerHTML }
	}

	render() {
		if (this.readOnly) this.renderLauncher()
		else if (this.draft) this.renderAuthoring()
		else this.renderKindPicker()
		return this.wrapper
	}

	renderKindPicker() {
		this.destroyEditors()
		this.wrapper.replaceChildren()
		const card = this.element('div', 'coding-lab-kind-picker')
		card.append(
			this.element('strong', '', 'Choose a Coding Lab'),
			this.element(
				'p',
				'coding-lab-muted',
				'Start with a Web or Python workspace.'
			)
		)
		const actions = this.element('div', 'coding-lab-kind-actions')
		for (const [kind, label, help] of [
			['web', 'Web', 'HTML, CSS and JavaScript'],
			['python', 'Python', 'Python editor and terminal'],
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
		this.destroyEditors()
		this.wrapper.replaceChildren()
		const header = this.element('div', 'coding-lab-author-header')
		const heading = this.element('div', 'coding-lab-heading')
		heading.append(
			this.element('strong', '', 'Coding Lab'),
			this.element('span', 'coding-lab-mode-badge', modeLabel(this.draft))
		)
		header.append(heading)
		this.wrapper.append(header)

		const terminal = this.element('div', 'coding-lab-author-terminal')
		const taskGrid = this.element('div', 'coding-lab-author-task-grid')
		taskGrid.append(
			this.field('Title', 'title', this.draft.title),
			this.field(
				'Task / instructions',
				'instructions',
				this.draft.instructions,
				true
			)
		)
		terminal.append(taskGrid)
		if (this.draft.lab_kind === 'web')
			terminal.append(this.renderWebFilePicker())
		terminal.append(this.renderIde())
		this.wrapper.append(terminal)
		queueMicrotask(() =>
			this.codeEditors.forEach((editor) => editor.resize())
		)

		const footer = this.element('div', 'coding-lab-author-footer')
		const save = this.button('Save IDE', 'primary')
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
		wrapper.append(this.element('legend', '', 'Files'))
		WEB_FILE_KEYS.forEach((file) => {
			const label = this.element('label', 'coding-lab-file-check')
			const input = document.createElement('input')
			input.type = 'checkbox'
			input.value = file
			input.checked = this.draft.enabled_web_files.includes(file)
			input.dataset.webFile = file
			input.addEventListener('change', () => {
				if (
					!this.wrapper.querySelectorAll('[data-web-file]:checked').length
				) {
					input.checked = true
					return
				}
				this.syncDraftFromFields()
				this.renderAuthoring()
				this.setStatus('Unsaved changes', 'dirty')
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
		const run = this.button('Run', 'primary')
		run.addEventListener('click', () => this.run())
		actions.append(run)
		const stop = this.button('Stop')
		stop.addEventListener('click', () => this.stopRuntime(true))
		actions.append(stop)
		topbar.append(tabs, actions)
		ide.append(topbar)

		files.forEach((file) => {
			const host = this.element('div', 'coding-lab-ace-editor')
			host.classList.toggle('is-active', file === active)
			host.dataset.codeFile = file
			host.setAttribute('aria-label', FILE_LABELS[file])
			ide.append(host)
			const editor = createCodingLabAceEditor(host, {
				value: this.draft.starter_files[file] || '',
				language: file,
				onChange: (value) => {
					this.draft.starter_files[file] = value
					this.setStatus('Unsaved changes', 'dirty')
				},
			})
			this.codeEditors.set(file, editor)
		})

		const javaScriptOnly =
			this.draft.lab_kind === 'web' &&
			files.length === 1 &&
			files[0] === 'javascript'
		if (this.draft.lab_kind === 'web') {
			const preview = document.createElement('iframe')
			preview.className = 'coding-lab-author-preview'
			if (javaScriptOnly) preview.classList.add('hidden')
			preview.dataset.role = 'preview'
			preview.sandbox = 'allow-scripts'
			preview.title = 'Coding Lab preview'
			ide.append(preview)
		}

		const output = this.element(
			'section',
			'coding-lab-console coding-lab-author-console'
		)
		output.dataset.role = 'console'
		output.classList.toggle('is-collapsed', !this.draft.ui.console_open)
		output.style.height = this.draft.ui.console_open
			? `${this.draft.ui.console_height}px`
			: ''
		const resizer = this.element('div', 'coding-lab-console-resizer')
		resizer.hidden = !this.draft.ui.console_open
		resizer.tabIndex = 0
		resizer.setAttribute('role', 'separator')
		resizer.setAttribute('aria-orientation', 'horizontal')
		resizer.setAttribute('aria-label', 'Resize Console')
		const setConsoleHeight = (height) => {
			this.draft.ui.console_height = Math.min(
				420,
				Math.max(100, Number(height) || 180)
			)
			output.style.height = `${this.draft.ui.console_height}px`
			this.setStatus('Unsaved changes', 'dirty')
		}
		resizer.addEventListener('pointerdown', (event) => {
			const startY = event.clientY
			const startHeight = this.draft.ui.console_height
			const resize = (moveEvent) =>
				setConsoleHeight(startHeight + startY - moveEvent.clientY)
			const stop = () => {
				window.removeEventListener('pointermove', resize)
				window.removeEventListener('pointerup', stop)
			}
			window.addEventListener('pointermove', resize)
			window.addEventListener('pointerup', stop)
		})
		resizer.addEventListener('keydown', (event) => {
			if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
			event.preventDefault()
			setConsoleHeight(
				this.draft.ui.console_height +
					(event.key === 'ArrowUp' ? 20 : -20)
			)
		})
		const titlebar = this.element('div', 'coding-lab-console-titlebar')
		titlebar.append(
			this.element(
				'strong',
				'coding-lab-console-title',
				this.draft.lab_kind === 'python' ? 'Terminal' : 'Console'
			)
		)
		const hide = this.button('Hide', 'quiet')
		hide.addEventListener('click', () => {
			output.classList.toggle('is-collapsed')
			this.draft.ui.console_open =
				!output.classList.contains('is-collapsed')
			resizer.hidden = !this.draft.ui.console_open
			output.style.height = this.draft.ui.console_open
				? `${this.draft.ui.console_height}px`
				: ''
			hide.textContent = this.draft.ui.console_open ? 'Hide' : 'Show'
			this.setStatus('Unsaved changes', 'dirty')
		})
		hide.textContent = this.draft.ui.console_open ? 'Hide' : 'Show'
		titlebar.append(hide)
		const pre = document.createElement('pre')
		pre.dataset.role = 'console-output'
		pre.setAttribute('aria-live', 'polite')
		const inputForm = this.element('form', 'coding-lab-stdin hidden')
		inputForm.dataset.role = 'stdin-form'
		const prompt = this.element('label')
		prompt.dataset.role = 'stdin-prompt'
		const input = document.createElement('input')
		input.type = 'text'
		input.autocomplete = 'off'
		input.spellcheck = false
		input.dataset.role = 'stdin-input'
		const submit = this.button('Enter', 'primary')
		submit.type = 'submit'
		inputForm.append(prompt, input, submit)
		inputForm.addEventListener('submit', (event) => {
			event.preventDefault()
			this.submitPythonInput(input.value)
		})
		output.append(titlebar, pre, inputForm)
		ide.append(resizer, output)
		return ide
	}

	field(labelText, name, value, multiline = false) {
		const label = this.element('label', 'coding-lab-terminal-field')
		label.append(this.element('span', '', labelText))
		const input = multiline
			? document.createElement('textarea')
			: document.createElement('input')
		input.dataset.field = name
		input.value = value || ''
		input.addEventListener('input', () =>
			this.setStatus('Unsaved changes', 'dirty')
		)
		label.append(input)
		return label
	}

	syncDraftFromFields() {
		if (!this.draft) return
		const value = (selector) =>
			this.wrapper.querySelector(selector)?.value ?? ''
		this.draft.title =
			value('[data-field="title"]') || 'Untitled Coding Lab'
		this.draft.instructions = value('[data-field="instructions"]')
		this.codeEditors.forEach((editor, file) => {
			this.draft.starter_files[file] = editor.getValue()
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
		this.wrapper.querySelectorAll('[data-code-file]').forEach((host) => {
			host.classList.toggle('is-active', host.dataset.codeFile === file)
		})
		const editor = this.codeEditors.get(file)
		editor?.resize()
		editor?.focus()
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
				reject(new Error('Course Lesson save handler is unavailable.'))
		})
	}

	async saveIde() {
		if (!this.draft || this.saving) return
		this.saving = true
		const button = this.wrapper.querySelector('[data-role="save-ide"]')
		if (button) button.disabled = true
		this.setStatus('Saving…', 'saving')
		const previous = this.data
		try {
			this.syncDraftFromFields()
			const next = serializeCodingLab(this.draft, this.blockId)
			await this.requestLessonSave(() => {
				this.data = next
				this.draft = serializeCodingLab(next, this.blockId)
				this.block?.dispatchChange?.()
			})
			this.setStatus('Saved', 'saved')
		} catch (error) {
			this.data = previous
			console.error('[Coding Lab] Save IDE failed', error)
			this.setStatus('Error saving IDE', 'error')
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

	run() {
		this.syncDraftFromFields()
		this.clearOutput()
		if (this.draft.lab_kind === 'python') this.runPython()
		else this.runWeb()
	}

	runWeb() {
		const frame = this.wrapper.querySelector('[data-role="preview"]')
		if (!frame) return
		const files = this.draft.starter_files
		this.channel = `coding-lab-${Math.random().toString(36).slice(2)}`
		frame.srcdoc = buildSandboxDocument({
			html: this.draft.enabled_web_files.includes('html') ? files.html : '',
			css: this.draft.enabled_web_files.includes('css') ? files.css : '',
			javascript: this.draft.enabled_web_files.includes('javascript')
				? files.javascript
				: '',
			channel: this.channel,
		})
	}

	stopWeb(showMessage = false) {
		const frame = this.wrapper.querySelector('[data-role="preview"]')
		this.channel = `coding-lab-${Math.random().toString(36).slice(2)}`
		if (frame) frame.srcdoc = '<!doctype html><html><body></body></html>'
		if (showMessage) this.appendOutput('Execution stopped.')
	}

	stopRuntime(showMessage = false) {
		if (this.draft?.lab_kind === 'python') this.stopPython(showMessage)
		else this.stopWeb(showMessage)
	}

	createPythonWorker() {
		const url = URL.createObjectURL(
			new Blob([pyodideWorkerSource()], { type: 'text/javascript' })
		)
		this.pythonWorkerUrl = url
		this.pythonWorker = new Worker(url)
		this.pythonWorker.onmessage = ({ data }) =>
			this.handlePythonMessage(data)
	}

	runPython() {
		this.stopPython()
		this.pythonInputs = []
		this.hidePythonInput()
		this.appendOutput('Starting Python…')
		this.createPythonWorker()
		this.runPythonAttempt()
	}

	runPythonAttempt() {
		if (!this.pythonWorker) return
		clearTimeout(this.pythonTimer)
		this.pythonTimer = setTimeout(() => {
			this.stopPython()
			this.appendError('Execution timeout: possible infinite loop.')
		}, 20000)
		this.pythonWorker.postMessage({
			code: this.draft.starter_files.python,
			inputs: [...this.pythonInputs],
		})
	}

	handlePythonMessage(data) {
		if (data.type === 'status') {
			this.clearOutput()
			this.appendOutput(data.message)
			return
		}
		clearTimeout(this.pythonTimer)
		this.clearOutput()
		if (data.stdout) this.appendOutput(data.stdout.trimEnd())
		if (data.stderr) this.appendError(data.stderr)
		if (data.type === 'input-request') {
			this.showPythonInput(data.prompt)
			return
		}
		this.hidePythonInput()
		if (data.type === 'error') this.appendError(data.message)
		else if (!data.stdout && !data.stderr)
			this.appendOutput('Code ran successfully with no output.')
	}

	showPythonInput(promptText = '') {
		const form = this.wrapper.querySelector('[data-role="stdin-form"]')
		const prompt = this.wrapper.querySelector('[data-role="stdin-prompt"]')
		const input = this.wrapper.querySelector('[data-role="stdin-input"]')
		if (!form || !prompt || !input) return
		prompt.textContent = promptText
		input.value = ''
		form.classList.remove('hidden')
		input.focus()
	}

	hidePythonInput() {
		this.wrapper
			.querySelector('[data-role="stdin-form"]')
			?.classList.add('hidden')
	}

	submitPythonInput(value) {
		if (!this.pythonWorker) return
		this.pythonInputs.push(value)
		this.hidePythonInput()
		this.runPythonAttempt()
	}

	stopPython(showMessage = false) {
		this.pythonWorker?.terminate()
		this.pythonWorker = null
		if (this.pythonWorkerUrl) URL.revokeObjectURL(this.pythonWorkerUrl)
		this.pythonWorkerUrl = null
		clearTimeout(this.pythonTimer)
		this.hidePythonInput()
		if (showMessage) this.appendOutput('Execution stopped.')
	}

	handleMessage(event) {
		const frame = this.wrapper.querySelector('[data-role="preview"]')
		if (!isCodingLabMessage(event, frame?.contentWindow, this.channel)) return
		const data = event.data
		if (data.type === 'console')
			this.appendOutput(`[${data.level}] ${data.args.join(' ')}`)
		else if (data.type === 'runtime-error') this.appendError(data.message)
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
		this.appendOutput(String(error?.message || error || 'Unknown runtime error'))
	}

	renderLauncher() {
		this.destroyEditors()
		this.wrapper.replaceChildren()
		if (!Object.keys(this.data).length) {
			this.wrapper.append('This Coding Lab is unavailable.')
			return
		}
		const lab = normalizeCodingLab(this.data, this.blockId)
		const card = this.element('section', 'coding-lab-practice-card')
		const content = this.element('div', 'coding-lab-practice-content')
		const eyebrow = this.element(
			'span',
			'coding-lab-practice-eyebrow',
			'Practice'
		)
		const heading = this.element('div', 'coding-lab-heading')
		heading.append(
			this.element('h3', '', lab.title),
			this.element('span', 'coding-lab-mode-badge', modeLabel(lab))
		)
		content.append(eyebrow, heading)
		const summary = instructionsSummary(lab.instructions)
		if (summary)
			content.append(this.element('p', 'coding-lab-muted', summary))
		const open = this.button('Open lab', 'primary')
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

	destroyEditors() {
		this.codeEditors.forEach((editor) => editor.destroy())
		this.codeEditors.clear()
	}

	save() {
		return this.data
	}

	destroy() {
		this.stopRuntime()
		this.destroyEditors()
		window.removeEventListener('message', this.handleMessage)
	}
}

export class LegacyCodingLab extends CodingLab {
	static get toolbox() {
		return false
	}
}
