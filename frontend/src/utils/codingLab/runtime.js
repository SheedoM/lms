const encodeScript = (value) =>
	JSON.stringify(String(value || '')).replace(/<\/script/gi, '<\\/script')

export function buildSandboxDocument({
	html = '',
	css = '',
	javascript = '',
	channel,
}) {
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
	try {
		(0, eval)(${encodeScript(javascript)});
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
		['console', 'runtime-error', 'complete'].includes(data.type)
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
		pyodide.globals.set('__lms_code', String(data.code || ''));
		pyodide.globals.set('__lms_inputs_json', JSON.stringify(data.inputs || []));
		await pyodide.runPythonAsync(\`
import json

class __LMSInputRequest(Exception):
    pass

__lms_input_values = json.loads(__lms_inputs_json)
__lms_input_index = 0
__lms_input_request = None

def __lms_input(prompt=""):
    global __lms_input_index
    prompt = str(prompt)
    if __lms_input_index >= len(__lms_input_values):
        raise __LMSInputRequest(prompt)
    value = str(__lms_input_values[__lms_input_index])
    __lms_input_index += 1
    print(prompt, end="")
    print(value)
    return value

__lms_scope = {"__name__": "__main__", "input": __lms_input}
try:
    exec(compile(__lms_code, "<student-code>", "exec"), __lms_scope, __lms_scope)
except __LMSInputRequest as request:
    __lms_input_request = str(request)
\`);
		const prompt = pyodide.globals.get('__lms_input_request');
		if (prompt !== undefined && prompt !== null) {
			self.postMessage({ type: 'input-request', prompt: String(prompt), stdout, stderr });
		} else {
			self.postMessage({ type: 'result', stdout, stderr });
		}
	} catch (error) {
		self.postMessage({ type: 'error', message: error.stack || error.message || String(error) });
	}
};`
}
