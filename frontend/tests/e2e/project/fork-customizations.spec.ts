import {test, expect} from '../../support/fixtures'
import {apiRootUrl} from '../../support/apiUrl'
import {updateUserSettings} from '../../support/updateUserSettings'

for (const kind of [0, 1, 2, 3] as const) {
	test(`fork: includes descendant tasks in view ${kind}`, async ({authenticatedPage: page, apiContext, userToken}) => {
		const api = `${apiRootUrl(process.env.API_URL || 'http://localhost:3456')}/api/v2`
		const headers = {Authorization: `Bearer ${userToken}`}
		const createProject = async (data: Record<string, unknown>) => {
			const response = await apiContext.post(`${api}/projects`, {headers, data})
			expect(response.ok()).toBe(true)
			return await response.json()
		}
		const parent = await createProject({title: 'Fork parent', hex_color: 'ff0000'})
		const child = await createProject({title: 'Fork child', parent_project_id: parent.id})
		const response = await apiContext.post(`${api}/projects/${child.id}/tasks`, {headers, data: {
			title: 'Descendant task', start_date: new Date().toISOString(), end_date: new Date(Date.now() + 86400000).toISOString(),
		}})
		expect(response.ok()).toBe(true)
		await updateUserSettings(apiContext, userToken, {frontend_settings: {include_subprojects: true}})
		const view = parent.views.find((view: {view_kind: string}) => view.view_kind === ['list', 'gantt', 'table', 'kanban'][kind])
		await page.goto(`/projects/${parent.id}/${view.id}`)
		await expect(page.getByText('Descendant task', {exact: false}).first()).toBeVisible()
		await page.reload()
		await expect(page.getByText('Descendant task', {exact: false}).first()).toBeVisible()
		if (kind === 3) {
			const parentBucket = page.locator('.kanban .bucket').first()
			await parentBucket.locator('.bucket-footer .button').filter({hasText: /Add (another task|a task)/i}).click()
			const input = parentBucket.locator('.bucket-footer input.input')
			await input.fill('Parent task remains editable')
			await input.press('Enter')
			await expect(parentBucket).toContainText('Parent task remains editable')
		}
		await updateUserSettings(apiContext, userToken, {frontend_settings: {include_subprojects: false}})
		await page.reload()
		await expect(page.getByText('Descendant task', {exact: false})).toHaveCount(0)
	})
}

test('fork: preserves color default and task toggle through the v2 client', async ({authenticatedPage: page, apiContext, userToken}) => {
	const api = `${apiRootUrl(process.env.API_URL || 'http://localhost:3456')}/api/v2`
	const headers = {Authorization: `Bearer ${userToken}`}
	const response = await apiContext.post(`${api}/projects`, {headers, data: {title: 'Color project', hex_color: 'ff0000'}})
	expect(response.ok()).toBe(true)
	const project = await response.json()
	await page.goto('/user/settings/general')
	await page.getByText('Use the project color by default for new tasks', {exact: true}).click()
	await page.locator('[data-cy=saveGeneralSettings]').click()
	await expect(page.locator('.global-notification')).toContainText('Success')
	const view = project.views.find((view: {view_kind: string}) => view.view_kind === 'list')
	await page.goto(`/projects/${project.id}/${view.id}`)
	await page.locator('.task-add textarea').fill('Inherited task')
	const createdPromise = page.waitForResponse(response => response.url().includes(`/projects/${project.id}/tasks`) && response.request().method() === 'POST')
	await page.locator('.task-add textarea').press('Enter')
	const body = await (await createdPromise).json()
	const created = body.tasks?.[0] ?? body
	expect(created.inherit_project_color).toBe(true)
	await expect(page.locator('.tasks .color-bubble')).toHaveCSS('background-color', 'rgb(255, 0, 0)')
	await page.reload()
	await expect(page.locator('.tasks .color-bubble')).toHaveCSS('background-color', 'rgb(255, 0, 0)')
	await page.goto(`/tasks/${created.id}`)
	const toggle = page.getByText('Use the project color', {exact: true})
	const saved = page.waitForResponse(response => response.url().includes(`/tasks/${created.id}`) && response.request().method() === 'PATCH')
	await toggle.click()
	expect((await saved).ok()).toBe(true)
	await page.reload()
	await expect(page.locator('.task-view .color-bubble')).toHaveCount(0)
})
