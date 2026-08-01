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
				panels.forEach((panel) =>
					panel.classList.toggle('is-active', panel.dataset.coursePanel === slug)
				)
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
		let pythonWorker = null
		let pythonWorkerUrl = null

		languageButtons.forEach((button) => {
			button.addEventListener('click', () => {
				drafts[language] = editor.value
				language = button.dataset.labLanguage
				editor.value = drafts[language]
				languageButtons.forEach((item) =>
					item.classList.toggle('is-active', item === button)
				)
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

		window.addEventListener('beforeunload', stopPythonWorker, { once: true })

		async function run() {
			drafts[language] = editor.value
			setBusy(true)
			output.textContent = language === 'python' ? 'بيتم تجهيز Python وتشغيل الكود…' : 'بيتم تشغيل الكود…'
			try {
				const result =
					language === 'python'
						? await runPython(editor.value)
						: await runJavaScript(editor.value)
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

		function runPython(code) {
			if (!pythonWorker) {
				const source = createPythonWorkerSource(
					window.ftLandingConfig?.pyodideIndexUrl ||
						'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
				)
				pythonWorkerUrl = URL.createObjectURL(
					new Blob([source], { type: 'text/javascript' })
				)
				pythonWorker = new Worker(pythonWorkerUrl)
			}

			return new Promise((resolve, reject) => {
				const timer = window.setTimeout(() => {
					stopPythonWorker()
					reject(new Error('الكود استغرق وقتًا أطول من المسموح وتم إيقافه.'))
				}, 30000)

				pythonWorker.onmessage = ({ data }) => {
					if (data.type === 'status') {
						output.textContent = data.message
						return
					}
					window.clearTimeout(timer)
					if (data.type === 'result') {
						resolve([data.stdout, data.stderr].filter(Boolean).join('\n'))
					} else {
						reject(new Error(data.message || 'حصل خطأ أثناء تشغيل Python.'))
					}
				}
				pythonWorker.onerror = (event) => {
					window.clearTimeout(timer)
					stopPythonWorker()
					reject(new Error(event.message || 'تعذر تشغيل بيئة Python.'))
				}
				pythonWorker.postMessage({ code })
			})
		}

		function stopPythonWorker() {
			pythonWorker?.terminate()
			pythonWorker = null
			if (pythonWorkerUrl) URL.revokeObjectURL(pythonWorkerUrl)
			pythonWorkerUrl = null
		}
	}

	function createPythonWorkerSource(indexUrl) {
		return `
let pyodide;
const indexURL = ${JSON.stringify(indexUrl)};
self.onmessage = async ({ data }) => {
  try {
    if (!pyodide) {
      self.postMessage({ type: 'status', message: 'بيتم تحميل بيئة Python لأول مرة…' });
      importScripts(indexURL + 'pyodide.js');
      pyodide = await loadPyodide({ indexURL });
    }
    let stdout = '';
    let stderr = '';
    pyodide.setStdout({ batched: text => { stdout += text + '\\n'; } });
    pyodide.setStderr({ batched: text => { stderr += text + '\\n'; } });
    pyodide.globals.set('__ft_code', String(data.code || ''));
    try {
      await pyodide.runPythonAsync('exec(compile(__ft_code, "<public-lab>", "exec"), {"__name__": "__main__"})');
      self.postMessage({ type: 'result', stdout, stderr });
    } finally {
      pyodide.globals.delete('__ft_code');
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error.stack || error.message || String(error) });
  }
};`
	}

	function runJavaScript(code) {
		return new Promise((resolve, reject) => {
			const source = `
self.onmessage = ({ data }) => {
  const logs = [];
  const stringify = value => {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch (_) { return String(value); }
  };
  console.log = (...values) => logs.push(values.map(stringify).join(' '));
  console.info = console.log;
  console.warn = console.log;
  console.error = console.log;
  try {
    new Function(String(data.code || ''))();
    self.postMessage({ type: 'result', output: logs.join('\\n') });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.stack || error.message || String(error) });
  }
};`
			const workerUrl = URL.createObjectURL(
				new Blob([source], { type: 'text/javascript' })
			)
			const worker = new Worker(workerUrl)
			const timer = window.setTimeout(() => {
				cleanup()
				reject(new Error('الكود استغرق وقتًا أطول من المسموح وتم إيقافه.'))
			}, 5000)

			worker.onmessage = ({ data }) => {
				cleanup()
				if (data.type === 'result') resolve(data.output)
				else reject(new Error(data.message || 'حصل خطأ أثناء تشغيل JavaScript.'))
			}
			worker.onerror = (event) => {
				cleanup()
				reject(new Error(event.message || 'تعذر تشغيل JavaScript.'))
			}
			worker.postMessage({ code })

			function cleanup() {
				window.clearTimeout(timer)
				worker.terminate()
				URL.revokeObjectURL(workerUrl)
			}
		})
	}

	function formatError(error) {
		if (!error) return 'حصل خطأ غير متوقع أثناء تشغيل الكود.'
		return error.message || String(error)
	}
})()
