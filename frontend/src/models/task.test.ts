import {beforeEach, describe, expect, it} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'

import BucketModel from './bucket'
import ProjectModel from './project'
import TaskModel, {getEffectiveTaskHexColor} from './task'
import TaskDuplicateModel from './taskDuplicateModel'
import {useAuthStore} from '@/stores/auth'

const generatedLabel = {
	id: 1,
	title: 'Label',
	hex_color: 'ff006e',
	created_by: {id: 2, username: 'creator'},
}

function expectGeneratedLabel(label: Record<string, unknown>) {
	expect(label).toMatchObject(generatedLabel)
	expect(label).not.toHaveProperty('hexColor')
	expect(label).not.toHaveProperty('createdBy')
}

describe('TaskModel labels', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('preserves generated label field casing', () => {
		const task = new TaskModel({
			labels: [generatedLabel],
		})

		expectGeneratedLabel(task.labels[0])
	})

	it.each([
		['bucket', () => new BucketModel({tasks: [{labels: [generatedLabel]}], created_by: {}} as never).tasks[0]],
		['project', () => new ProjectModel({tasks: [{labels: [generatedLabel]}], owner: {}, views: []} as never).tasks[0]],
		['duplicate', () => new TaskDuplicateModel({duplicated_task: {labels: [generatedLabel]}} as never).duplicatedTask],
	])('restores generated casing after %s model conversion', (_, createTask) => {
		const task = createTask()

		expectGeneratedLabel(task!.labels[0])
	})

	it('restores generated casing on related tasks', () => {
		const task = new TaskModel({
			related_tasks: {
				subtask: [{labels: [generatedLabel]}],
			},
		} as never)

		expectGeneratedLabel(task.relatedTasks.subtask![0].labels[0])
	})
})

describe('TaskModel creation defaults', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('uses the current user preference only when no task value was supplied', () => {
		const authStore = useAuthStore()
		authStore.setUserSettings({
			...authStore.settings,
			frontendSettings: {
				...authStore.settings.frontendSettings,
				inheritProjectColorByDefaultForNewTasks: true,
			},
		})

		expect(new TaskModel().inheritProjectColor).toBe(true)
		expect(new TaskModel({inheritProjectColor: false}).inheritProjectColor).toBe(false)
	})

	it('defaults to false when the user preference is disabled', () => {
		expect(new TaskModel().inheritProjectColor).toBe(false)
	})
})

describe('getEffectiveTaskHexColor', () => {
	it('uses the project color only while inheritance is enabled', () => {
		const task = new TaskModel({hexColor: '#cc0000'})
		const project = {hexColor: '#00cc00'}

		expect(getEffectiveTaskHexColor(task, project)).toBe('#cc0000')

		task.inheritProjectColor = true
		expect(getEffectiveTaskHexColor(task, project)).toBe('#00cc00')

		project.hexColor = '#0000cc'
		expect(getEffectiveTaskHexColor(task, project)).toBe('#0000cc')

		const movedToProject = {hexColor: '#cc00cc'}
		expect(getEffectiveTaskHexColor(task, movedToProject)).toBe('#cc00cc')

		task.inheritProjectColor = false
		expect(getEffectiveTaskHexColor(task, project)).toBe('#cc0000')
	})

	it('falls back to the task color when the project has none', () => {
		const task = new TaskModel({hexColor: '#cc0000', inheritProjectColor: true})

		expect(getEffectiveTaskHexColor(task, {hexColor: ''})).toBe('#cc0000')
		expect(getEffectiveTaskHexColor(task, {hexColor: '#'})).toBe('#cc0000')
	})
})
