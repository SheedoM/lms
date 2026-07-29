const RULES = [
	[/timeout|timed out|infinite loop/i, 'الكود أخد وقت زيادة، غالبًا فيه لوب مبتخلصش. راجع شروط اللوب وجرب تاني.'],
	[/indentationerror|unexpected indent|unindent/i, 'فيه مشكلة في المسافات اللي في أول السطور. خلّي البلوكات جوه بعض بنفس عدد المسافات.'],
	[/modulenotfounderror|importerror|cannot find module/i, 'الموديول المطلوب مش موجود في بيئة التشغيل. راجع اسم الـ import واستخدم المكتبات المتاحة.'],
	[/zerodivisionerror|division by zero/i, 'الكود حاول يقسم على صفر. اتأكد إن المقسوم عليه مش صفر قبل القسمة.'],
	[/referenceerror|nameerror|is not defined|not defined/i, 'فيه اسم متغير أو دالة مش متعرّف. راجع الكتابة وتأكد إنه اتعرّف قبل الاستخدام.'],
	[/syntaxerror|invalid syntax|unexpected token/i, 'فيه خطأ في كتابة الكود. راجع الأقواس والعلامات وترتيب السطر المذكور في الرسالة.'],
	[/typeerror/i, 'فيه عملية اتعملت على نوع بيانات مش مناسب. راجع القيم وأنواعها في السطر المذكور.'],
]

const GENERIC =
	'حصل خطأ أثناء التشغيل، بس الرسالة مش كفاية لتشخيص محدد. ابدأ بالسطر المذكور وراجع القيم حواليه.'

export function isArabicDocument(root = document.documentElement) {
	const language = (root?.lang || '').toLowerCase()
	return root?.dir === 'rtl' || language === 'ar' || language.startsWith('ar-')
}

export function egyptianArabicErrorHint(error) {
	const message = String(error || '')
	return RULES.find(([pattern]) => pattern.test(message))?.[1] || GENERIC
}

export function formatRuntimeError(error, arabic = isArabicDocument()) {
	const original = String(error?.message || error || __('Unknown runtime error'))
	return arabic
		? { original, hint: egyptianArabicErrorHint(original) }
		: { original, hint: '' }
}
