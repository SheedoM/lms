import ace from 'ace-builds'
import 'ace-builds/src-min-noconflict/ext-searchbox'
import 'ace-builds/src-min-noconflict/theme-twilight'
import 'ace-builds/src-noconflict/mode-css'
import 'ace-builds/src-noconflict/mode-html'
import 'ace-builds/src-noconflict/mode-javascript'
import 'ace-builds/src-noconflict/mode-python'

const MODES = {
	css: 'ace/mode/css',
	html: 'ace/mode/html',
	javascript: 'ace/mode/javascript',
	python: 'ace/mode/python',
}

export function createCodingLabAceEditor(
	element,
	{ value = '', language = 'javascript', onChange = () => {}, readOnly = false } = {}
) {
	element.dir = 'ltr'
	element.lang = 'en'
	const editor = ace.edit(element)
	let applyingValue = false

	editor.setTheme('ace/theme/twilight')
	editor.session.setMode(MODES[language] || MODES.javascript)
	editor.session.setUseSoftTabs(true)
	editor.session.setTabSize(language === 'python' ? 4 : 2)
	editor.setReadOnly(readOnly)
	editor.setOptions({
		fontFamily:
			"'IBM Plex Mono', 'Cascadia Code', Consolas, 'Liberation Mono', monospace",
		fontSize: '14px',
		showGutter: true,
		showLineNumbers: true,
		showPrintMargin: false,
		highlightActiveLine: true,
		highlightSelectedWord: true,
		displayIndentGuides: true,
		enableBasicAutocompletion: false,
		enableLiveAutocompletion: false,
		useWorker: false,
		wrap: false,
	})
	editor.setValue(String(value || ''), -1)
	editor.session.getUndoManager().reset()
	editor.session.on('change', () => {
		if (!applyingValue) onChange(editor.getValue())
	})

	return {
		getValue: () => editor.getValue(),
		setValue(next, resetHistory = false) {
			const valueToSet = String(next || '')
			if (valueToSet === editor.getValue()) return
			applyingValue = true
			editor.setValue(valueToSet, -1)
			if (resetHistory) editor.session.getUndoManager().reset()
			applyingValue = false
		},
		setLanguage(next) {
			editor.session.setMode(MODES[next] || MODES.javascript)
			editor.session.setTabSize(next === 'python' ? 4 : 2)
		},
		focus: () => editor.focus(),
		resize: () => editor.resize(true),
		destroy: () => editor.destroy(),
	}
}
