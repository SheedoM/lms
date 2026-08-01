(() => {
	'use strict'

	const csrfToken = window.ftAuthConfig?.csrfToken || ''

	function getAlertBox(form) {
		return form.closest('.ft-auth-card').querySelector('[data-auth-alert]')
	}

	function showAlert(form, message) {
		const box = getAlertBox(form)
		box.textContent = message
		box.hidden = false
	}

	function hideAlert(form) {
		const box = getAlertBox(form)
		box.hidden = true
		box.textContent = ''
	}

	function setBusy(form, isBusy, busyLabel, idleLabel) {
		const btn = form.querySelector('.ft-auth-submit')
		const label = btn.querySelector('[data-btn-label]')
		btn.disabled = isBusy
		label.textContent = isBusy ? busyLabel : idleLabel
	}

	function extractErrorMessage(data) {
		if (!data) return null
		if (typeof data._server_messages === 'string') {
			try {
				const outer = JSON.parse(data._server_messages)
				for (const raw of outer) {
					try {
						const parsed = JSON.parse(raw)
						if (parsed.message) return parsed.message
					} catch (_) {
						/* not JSON, skip */
					}
				}
			} catch (_) {
				/* not a JSON array, skip */
			}
		}
		if (typeof data.message === 'string') return data.message
		if (typeof data.exception === 'string') return data.exception
		return null
	}

	async function callApi(method, args) {
		const response = await fetch(`/api/method/${method}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Frappe-CSRF-Token': csrfToken,
			},
			credentials: 'same-origin',
			body: JSON.stringify(args),
		})

		let data = null
		try {
			data = await response.json()
		} catch (_) {
			data = null
		}

		if (!response.ok) {
			throw new Error(extractErrorMessage(data) || 'حصل خطأ غير متوقع. حاول تاني.')
		}
		return data
	}

	const loginForm = document.querySelector('[data-login-form]')
	if (loginForm) {
		loginForm.addEventListener('submit', async (event) => {
			event.preventDefault()
			hideAlert(loginForm)

			const usr = loginForm.usr.value.trim()
			const pwd = loginForm.pwd.value
			const redirectTo = loginForm.redirect_to.value

			if (!usr || !pwd) {
				showAlert(loginForm, 'من فضلك أدخل البريد الإلكتروني وكلمة المرور.')
				return
			}

			setBusy(loginForm, true, 'جاري تسجيل الدخول…', 'تسجيل الدخول')
			try {
				const data = await callApi('login', { usr, pwd })
				window.location.href = redirectTo || data.home_page || '/lms'
			} catch (error) {
				showAlert(loginForm, error.message)
				setBusy(loginForm, false, 'جاري تسجيل الدخول…', 'تسجيل الدخول')
			}
		})
	}

	const signupForm = document.querySelector('[data-signup-form]')
	if (signupForm) {
		signupForm.addEventListener('submit', async (event) => {
			event.preventDefault()
			hideAlert(signupForm)

			const full_name = signupForm.full_name.value.trim()
			const email = signupForm.email.value.trim()
			const password = signupForm.password.value
			const confirm_password = signupForm.confirm_password.value
			const redirect_to = signupForm.redirect_to.value

			if (!full_name) {
				showAlert(signupForm, 'من فضلك أدخل اسمك بالكامل.')
				return
			}
			if (!email) {
				showAlert(signupForm, 'من فضلك أدخل بريد إلكتروني صحيح.')
				return
			}
			if (password.length < 8) {
				showAlert(signupForm, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.')
				return
			}
			if (password !== confirm_password) {
				showAlert(signupForm, 'كلمة المرور وتأكيدها غير متطابقين.')
				return
			}

			setBusy(signupForm, true, 'جاري إنشاء الحساب…', 'إنشاء حساب')
			try {
				const data = await callApi('lms.public_website.public_signup', {
					full_name,
					email,
					password,
					confirm_password,
					redirect_to,
				})
				window.location.href = (data.message && data.message.redirect_to) || '/lms'
			} catch (error) {
				showAlert(signupForm, error.message)
				setBusy(signupForm, false, 'جاري إنشاء الحساب…', 'إنشاء حساب')
			}
		})
	}
})()
