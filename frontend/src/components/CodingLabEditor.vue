<template>
	<div
		ref="host"
		class="coding-lab-ace-editor"
		dir="ltr"
		lang="en"
		:aria-label="ariaLabel"
	/>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createCodingLabAceEditor } from '@/utils/codingLab/aceEditor'

const props = defineProps({
	modelValue: { type: String, default: '' },
	language: { type: String, required: true },
	ariaLabel: { type: String, default: 'Code editor' },
})
const emit = defineEmits(['update:modelValue', 'change'])
const host = ref(null)
let editor = null

onMounted(() => {
	editor = createCodingLabAceEditor(host.value, {
		value: props.modelValue,
		language: props.language,
		onChange(value) {
			emit('update:modelValue', value)
			emit('change', value)
		},
	})
	nextTick(() => editor?.resize())
})

watch(
	() => props.modelValue,
	(value) => editor?.setValue(value)
)
watch(
	() => props.language,
	(language) => editor?.setLanguage(language)
)

onBeforeUnmount(() => {
	editor?.destroy()
	editor = null
})
</script>
