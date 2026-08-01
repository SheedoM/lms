(() => {
	'use strict'

	const form = document.querySelector('[data-subscription-form]')
	if (!form) return

	const message = form.querySelector('[data-form-message]')
	const submitButton = form.querySelector('[data-submit-button]')
	const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || ''

	form.addEventListener('submit', async (event) => {
		event.preventDefault()
		setMessage('', '')

		const data = new FormData(form)
		const screenshot = data.get('payment_screenshot')
		if (!(screenshot instanceof File) || !screenshot.size) {
			setMessage('من فضلك ارفع صورة إثبات الدفع.', 'error')
			return
		}

		setBusy(true)
		try {
			const fileUrl = await uploadScreenshot(screenshot)
			const result = await submitRequest({
				offering_slug: form.dataset.offeringSlug,
				payment_method: String(data.get('payment_method') || '').trim(),
				sender_phone: String(data.get('sender_phone') || '').trim(),
				payment_screenshot: fileUrl,
				notes: String(data.get('notes') || '').trim(),
			})
			showSuccess(result)
		} catch (error) {
			setMessage(error.message || 'حصلت مشكلة أثناء إرسال الطلب. جرّب مرة تانية.', 'error')
			setBusy(false)
		}
	})

	async function uploadScreenshot(file) {
		const payload = new FormData()
		payload.append('file', file)
		payload.append('is_private', '1')
		payload.append('folder', 'Home/Attachments')

		const response = await fetch('/api/method/upload_file', {
			method: 'POST',
			headers: csrfToken ? { 'X-Frappe-CSRF-Token': csrfToken } : {},
			body: payload,
			credentials: 'same-origin',
		})
		const body = await response.json().catch(() => ({}))
		if (!response.ok || !body.message?.file_url) {
			throw new Error(getServerMessage(body) || 'تعذر رفع صورة إثبات الدفع.')
		}
		return body.message.file_url
	}

	async function submitRequest(values) {
		const response = await fetch('/api/method/lms.public_website.submit_subscription_request', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(csrfToken ? { 'X-Frappe-CSRF-Token': csrfToken } : {}),
			},
			body: JSON.stringify(values),
			credentials: 'same-origin',
		})
		const body = await response.json().catch(() => ({}))
		if (!response.ok || body.exc) {
			throw new Error(getServerMessage(body) || 'تعذر إرسال طلب الاشتراك.')
		}
		return body.message || {}
	}

	function showSuccess(result) {
		form.innerHTML = `
			<div class="ft-request-success">
				<div class="ft-request-success-icon">✓</div>
				<h2>${result.already_exists ? 'طلبك قيد المراجعة بالفعل' : 'تم إرسال طلب الاشتراك'}</h2>
				<p>هنراجع بيانات الدفع، وبعدها هيتم تفعيل الكورس على حسابك.</p>
				${result.name ? `<small>رقم الطلب: ${escapeHtml(result.name)}</small>` : ''}
				<a class="ft-button ft-button-secondary" href="/lms">الرجوع للمنصة</a>
			</div>`
	}

	function setBusy(isBusy) {
		submitButton.disabled = isBusy
		submitButton.textContent = isBusy ? 'جاري إرسال الطلب…' : 'إرسال طلب الاشتراك'
	}

	function setMessage(text, type) {
		message.textContent = text
		message.className = `ft-form-message${type ? ` is-${type}` : ''}`
	}

	function getServerMessage(body) {
		if (body?._server_messages) {
			try {
				const messages = JSON.parse(body._server_messages)
				return messages.map((item) => {
					try {
						const parsed = JSON.parse(item)
						return parsed.message || parsed
					} catch (_) {
						return item
					}
				}).join('\n')
			} catch (_) {
				return body._server_messages
			}
		}
		return body?.message?.message || body?.message || ''
	}

	function escapeHtml(value) {
		return String(value)
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#039;')
	}
})()
