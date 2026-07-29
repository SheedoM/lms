const encodeScript = (value) =>
	JSON.stringify(String(value || '')).replace(/<\/script/gi, '<\\/script')

export function buildSandboxDocument({
	html = '',
	css = '',
	javascript = '',
	channel,
	tests = '',
	runTests = false,
}) {
	const testSource = runTests ? tests : ''
	return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>${html}<script>
(() => {
	const channel = ${encodeScript(channel)};
	const send = (type, payload = {}) => parent.postMessage({ source: 'lms-coding-lab', channel, type, ...payload }, '*');
	const clean = (value) => {
		try { return typeof value === 'string' ? value : JSON.stringify(value); }
		catch { return String(value); }
	};
	for (const level of ['log', 'info', 'warn', 'error']) {
		const original = console[level];
		console[level] = (...args) => { send('console', { level, args: args.map(clean) }); original.apply(console, args); };
	}
	addEventListener('error', event => send('runtime-error', { message: event.error?.stack || event.message }));
	addEventListener('unhandledrejection', event => send('runtime-error', { message: event.reason?.stack || String(event.reason) }));
	const tests = [];
	self.test = (name, fn) => tests.push({ name, fn });
	self.assert = (value, message = 'Expected value to be truthy') => { if (!value) throw new Error(message); };
	self.assertEqual = (actual, expected, message = '') => { if (!Object.is(actual, expected)) throw new Error(message || ('Expected ' + clean(expected) + ', received ' + clean(actual))); };
	try {
		(0, eval)(${encodeScript(`${javascript}\n${testSource}`)});
		if (${runTests ? 'true' : 'false'}) {
			const results = tests.map(({name, fn}) => {
				try { fn(); return { name, passed: true }; }
				catch (error) { return { name, passed: false, message: error.message }; }
			});
			send('tests', { results });
		}
		send('complete');
	} catch (error) {
		send('runtime-error', { message: error.stack || error.message || String(error) });
	}
})();
<\/script></body></html>`
}

export function isCodingLabMessage(event, frameWindow, channel) {
	const data = event?.data
	return (
		event?.source === frameWindow &&
		data?.source === 'lms-coding-lab' &&
		data?.channel === channel &&
		['console', 'runtime-error', 'tests', 'complete'].includes(data.type)
	)
}

export function pyodideWorkerSource(
	indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
) {
	return `
let pyodide;
const indexURL = ${JSON.stringify(indexURL)};
self.onmessage = async ({ data }) => {
	try {
		if (!pyodide) {
			self.postMessage({ type: 'status', message: 'Loading Python engine…' });
			importScripts(indexURL + 'pyodide.js');
			pyodide = await loadPyodide({ indexURL });
		}
		let stdout = '', stderr = '';
		pyodide.setStdout({ batched: text => { stdout += text + '\\n'; } });
		pyodide.setStderr({ batched: text => { stderr += text + '\\n'; } });
		const helpers = data.runTests ? \`
__lms_tests = []
def test(name, fn):
    try:
        fn()
        __lms_tests.append({"name": name, "passed": True})
    except Exception as error:
        __lms_tests.append({"name": name, "passed": False, "message": str(error)})
def assert_true(value, message="Expected value to be truthy"):
    if not value: raise AssertionError(message)
def assert_equal(actual, expected, message=""):
    if actual != expected: raise AssertionError(message or f"Expected {expected!r}, received {actual!r}")
\` : '';
		await pyodide.runPythonAsync(helpers + '\\n' + (data.code || '') + '\\n' + (data.runTests ? (data.tests || '') : ''));
		const results = data.runTests ? pyodide.runPython('__lms_tests').toJs({ dict_converter: Object.fromEntries }) : [];
		self.postMessage({ type: 'result', stdout, stderr, results });
	} catch (error) {
		self.postMessage({ type: 'error', message: error.stack || error.message || String(error) });
	}
};`
}
