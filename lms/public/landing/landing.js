(() => {
	'use strict'

	const menuButton = document.querySelector('[data-menu-button]')
	const mainNav = document.querySelector('[data-main-nav]')
	if (menuButton && mainNav) {
		menuButton.addEventListener('click', () => {
			const isOpen = mainNav.classList.toggle('is-open')
			menuButton.setAttribute('aria-expanded', String(isOpen))
		})
		mainNav.querySelectorAll('a').forEach((link) => {
			link.addEventListener('click', () => {
				mainNav.classList.remove('is-open')
				menuButton.setAttribute('aria-expanded', 'false')
			})
		})
	}

	const catalogue = document.querySelector('[data-course-catalogue]')
	if (catalogue) {
		const tabs = [...catalogue.querySelectorAll('[data-course-tab]')]
		const panels = [...catalogue.querySelectorAll('[data-course-panel]')]
		tabs.forEach((tab) => {
			tab.addEventListener('click', () => {
				const slug = tab.dataset.courseTab
				tabs.forEach((item) => {
					const active = item === tab
					item.classList.toggle('is-active', active)
					item.setAttribute('aria-selected', String(active))
				})
				panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.coursePanel === slug))
			})
		})
	}

	initPublicLab()

	function initPublicLab() {
		const lab = document.querySelector('[data-public-lab]')
		if (!lab) return

		const editor = lab.querySelector('[data-lab-editor]')
		const output = lab.querySelector('[data-lab-output]')
		const runButton = lab.querySelector('[data-lab-run]')
		const resetButton = lab.querySelector('[data-lab-reset]')
		const languageButtons = [...lab.querySelectorAll('[data-lab-language]')]
		if (!editor || !output || !runButton || !resetButton) return

		const starterCode = {
			python: editor.dataset.pythonCode || editor.value || '',
			javascript: editor.dataset.javascriptCode || '',
		}
		const drafts = { ...starterCode }
		let language = 'python'
		let pyodidePromise = null

		languageButtons.forEach((button) => {
			button.addEventListener('click', () => {
				drafts[language] = editor.value
				language = button.dataset.labLanguage
				editor.value = drafts[language]
				languageButtons.forEach((item) => item.classList.toggle('is-active', item === button))
				output.textContent = 'اضغط تشغيل علشان تشوف النتيجة هنا.'
			})
		})

		resetButton.addEventListener('click', () => {
			drafts[language] = starterCode[language]
			editor.value = starterCode[language]
			output.textContent = 'تمت إعادة الكود للمثال الأساسي.'
			editor.focus()
		})

		runButton.addEventListener('click', run)
		editor.addEventListener('keydown', (event) => {
			if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
				event.preventDefault()
				run()
			}
		})

		async function run() {
			drafts[language] = editor.value
			setBusy(true)
			output.textContent = language === 'python' ? 'بيتم تجهيز Python وتشغيل الكود…' : 'بيتم تشغيل الكود…'
			try {
				const result = language === 'python' ? await runPython(editor.value) : await runJavaScript(editor.value)
				output.textContent = result || 'تم تشغيل الكود من غير مخرجات.'
			} catch (error) {
				output.textContent = formatError(error)
			} finally {
				setBusy(false)
			}
		}

		function setBusy(isBusy) {
			runButton.disabled = isBusy
			runButton.textContent = isBusy ? 'جاري التشغيل…' : 'تشغيل ▶'
		}

		async function runPython(code) {
			if (!pyodidePromise) pyodidePromise = loadPyodideRuntime()
			const pyodide = await pyodidePromise
			pyodide.globals.set('_ft_user_code', code)
			try {
				return await pyodide.runPythonAsync(`
import contextlib
import io
import traceback

_ft_buffer = io.StringIO()
try:
    with contextlib.redirect_stdout(_ft_buffer), contextlib.redirect_stderr(_ft_buffer):
        exec(_ft_user_code, {})
except Exception:
    traceback.print_exc(file=_ft_buffer)
_ft_buffer.getvalue()
`)
			} finally {
				pyodide.globals.delete('_ft_user_code')
			}
		}

		async function loadPyodideRuntime() {
			const indexUrl = window.ftLandingConfig?.pyodideIndexUrl || 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'
			if (!window.loadPyodide) {
				await loadScript(`${indexUrl}pyodide.js`)
			}
			return window.loadPyodide({ indexURL: indexUrl })
		}
	}

	function loadScript(src) {
		return new Promise((resolve, reject) => {
			const existing = document.querySelector(`script[src="${src}"]`)
			if (existing) {
				existing.addEventListener('load', resolve, { once: true })
				existing.addEventListener('error', reject, { once: true })
				return
			}
			const script = document.createElement('script')
			script.src = src
			script.async = true
			script.addEventListener('load', resolve, { once: true })
			script.addEventListener('error', () => reject(new Error('تعذر تحميل بيئة Python. جرّب مرة تانية بعد التأكد من اتصال الإنترنت.')), { once: true })
			document.head.appendChild(script)
		})
	}

	function runJavaScript(code) {
		return new Promise((resolve) => {
			const executionId = `ft-${Date.now()}-${Math.random().toString(16).slice(2)}`
			const iframe = document.createElement('iframe')
			iframe.setAttribute('sandbox', 'allow-scripts')
			iframe.hidden = true

			const timeout = window.setTimeout(() => finish('انتهى وقت التشغيل قبل ما الكود يخلص.'), 5000)
			const onMessage = (event) => {
				if (event.data?.source !== 'ft-public-lab' || event.data?.executionId !== executionId) return
				finish(event.data.output)
			}

			function finish(result) {
				window.clearTimeout(timeout)
				window.removeEventListener('message', onMessage)
				iframe.remove()
				resolve(result)
			}

			window.addEventListener('message', onMessage)
			const encodedCode = JSON.stringify(code).replace(/</g, '\\u003c')
			iframe.srcdoc = `<!doctype html><meta charset="utf-8"><script>
const logs = [];
const stringify = (value) => {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch (_) { return String(value); }
};
console.log = (...values) => logs.push(values.map(stringify).join(' '));
console.error = (...values) => logs.push(values.map(stringify).join(' '));
try {
  const code = ${encodedCode};
  new Function(code)();
} catch (error) {
  logs.push(error && error.stack ? error.stack : String(error));
}
parent.postMessage({ source: 'ft-public-lab', executionId: '${executionId}', output: logs.join('\\n') }, '*');
<\/script>`
			document.body.appendChild(iframe)
		})
	}

	function formatError(error) {
		if (!error) return 'حصل خطأ غير متوقع أثناء تشغيل الكود.'
		return error.message || String(error)
	}
})()
