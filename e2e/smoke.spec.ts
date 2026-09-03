import { expect, test } from '@playwright/test';

test('onboarding leads into the photo-first feed', async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page.getByText('Делитесь идеями.')).toBeVisible();
  await page.getByRole('button', { name: 'Начать исследовать' }).click();
  await expect(page.getByText('Рассказывайте о том,')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Лента' })).toBeVisible();
});

test('discover supports keyword search and an empty state', async ({ page }) => {
  await page.goto('/discover');
  const search = page.getByPlaceholder('Слово, автор, тема или тег');
  await search.fill('несуществующий сигнал');
  await expect(page.getByText('Пока тихо')).toBeVisible();
  await search.fill('');
  await expect(page.getByText('Найдите своё')).toBeVisible();
});

test('guest actions send the user to the real auth screen', async ({ page }) => {
  await page.goto('/discover');
  await page.getByTestId('like-button').first().click();
  await expect(page.getByText('Найдите своё сообщество')).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: 'Создать' }).click();
  await expect(page.getByText('Создайте сигнал')).toBeVisible();
});

test('demo account can create and delete its own signal', async ({ page }) => {
  await page.goto('/auth');
  await page.getByPlaceholder('you@example.com').fill('demo@example.com');
  await page.getByPlaceholder('Пароль').fill('demo-password');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByText('Рассказывайте о том,')).toBeVisible();

  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(page.getByText('Новый сигнал', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Конкретная мысль, вопрос или прогресс…').fill('Проверка удаления собственного сигнала.');
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(page.getByText('Проверка удаления собственного сигнала.').last()).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByText('Новый сигнал', { exact: true })).toBeVisible();
});

test('auth and reset screens expose safe recovery states', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.getByText('Найдите своё сообщество')).toBeVisible();
  await page.getByRole('button', { name: 'Вход', exact: true }).click();
  await expect(page.getByText('Войти', { exact: true })).toBeVisible();
  await page.getByText('Забыли пароль?', { exact: true }).click();
  await page.getByPlaceholder('you@example.com').fill('person@example.com');
  await page.getByRole('button', { name: 'Отправить ссылку', exact: true }).click();
  await expect(page.getByText('В demo mode письмо не отправляется')).toBeVisible();

  await page.goto('/auth/reset');
  await page.getByRole('button', { name: 'Сохранить пароль', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Ссылка восстановления недействительна.');
});

test('admin route stays protected for guests', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('Нет доступа', { exact: true })).toBeVisible();
  await expect(page.getByText('Раздел доступен только администраторам.')).toBeVisible();
});

test('theme and language controls remain available in profile', async ({ page }) => {
  await page.goto('/profile');
  await expect(page.getByRole('button', { name: 'Профиль', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Войти или зарегистрироваться', exact: true })).toBeVisible();
  await expect(page.getByText('Айлин Нурбек', { exact: true })).toHaveCount(0);
  await page.getByText('Тема', { exact: true }).click();
  await expect(page.getByText('Тёмная')).toBeVisible();
  await page.getByText('Язык', { exact: true }).click();
  await expect(page.getByText('Қазақша')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Қазақша')).toBeVisible();
  await expect(page.getByText('Қараңғы')).toBeVisible();
});
