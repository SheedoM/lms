<template>
	<StudentLearning v-if="isPureStudent" />
	<Courses v-else />
</template>

<script setup lang="ts">
import Courses from './Courses.vue'
import StudentLearning from './StudentLearning.vue'
import { usePureStudent } from '@/composables/useStudentExperience'

const isPureStudent = usePureStudent()
</script>
