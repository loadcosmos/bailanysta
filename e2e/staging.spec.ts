import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const signupEmail = process.env.E2E_SIGNUP_EMAIL;
const signupPassword = process.env.E2E_SIGNUP_PASSWORD;
const targetUserId = process.env.E2E_TARGET_USER_ID;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, userEmail = email, userPassword = password) {
  if (!userEmail || !userPassword) throw new Error('E2E credentials are missing');
  await page.goto('/auth');
  await page.getByRole('button', { name: 'Вход', exact: true }).click();
  await page.getByPlaceholder('you@example.com').fill(userEmail);
  await page.getByPlaceholder('Пароль').fill(userPassword);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByText('Рассказывайте о том,')).toBeVisible();
}

test.describe('staging release contract', () => {
  test.skip(
    !email || !password,
    'Set E2E_EMAIL and E2E_PASSWORD for the Supabase staging account.',
  );

  test('signup/signin, signout and forgot-password surface work', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'Профиль', exact: true }).click();
    await expect(page.getByText('Выйти', { exact: true })).toBeVisible();
    await page.getByText('Выйти', { exact: true }).click();
    await expect(page.getByText('Войти или зарегистрироваться', { exact: true })).toBeVisible();

    await page.goto('/auth');
    await page.getByText('Забыли пароль?', { exact: true }).click();
    await expect(page.getByText('Вернём доступ')).toBeVisible();
    await page.getByPlaceholder('you@example.com').fill(email!);
    await page.getByRole('button', { name: 'Отправить ссылку', exact: true }).click();
    await expect(page.getByText('Если такой email зарегистрирован')).toBeVisible();
  });

  test('a fresh staging account can sign up when a disposable inbox is configured', async ({ page }) => {
    test.skip(!signupEmail || !signupPassword, 'Set E2E_SIGNUP_EMAIL and E2E_SIGNUP_PASSWORD for signup coverage.');
    await page.goto('/auth');
    await page.getByPlaceholder('you@example.com').fill(signupEmail!);
    await page.getByPlaceholder('Пароль').fill(signupPassword!);
    await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
    await expect(page.getByText('Рассказывайте о том,')).toBeVisible();
  });

  test('create, edit, like and comment a real signal', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'Создать', exact: true }).click();
    await expect(page.getByText('Новый сигнал')).toBeVisible();
    const body = `Staging signal ${Date.now()}: маленький шаг, который стоит сохранить.`;
    await page.getByPlaceholder('Конкретная мысль, вопрос или прогресс…').fill(body);
    await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
    await expect(page.getByText(body).last()).toBeVisible();

    await page.getByTestId('like-button').click();
    await page.getByTestId('like-button').click();
    await page.getByPlaceholder('Добавить комментарий…').fill('Проверка реального комментария.');
    await page.getByRole('button', { name: 'Отправить', exact: true }).click();
    await expect(page.getByText('Проверка реального комментария.')).toBeVisible();

    await page.getByText('Изменить', { exact: true }).click();
    const updated = `${body} Обновлено.`;
    await page.getByPlaceholder('Конкретная мысль, вопрос или прогресс…').fill(updated);
    await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
    await expect(page.getByText(updated).last()).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();
    await expect(page.getByText('Новый сигнал', { exact: true })).toBeVisible();
  });

  test('follow and unfollow a second staging user', async ({ page }) => {
    test.skip(!targetUserId, 'Set E2E_TARGET_USER_ID for follow coverage.');
    await signIn(page);
    await page.goto(`/profile/${targetUserId}`);
    await expect(page.getByText('Подписаться', { exact: true })).toBeVisible();
    await page.getByText('Подписаться', { exact: true }).click();
    await expect(page.getByText('Вы подписаны', { exact: true })).toBeVisible();
    await page.getByText('Вы подписаны', { exact: true }).click();
    await expect(page.getByText('Подписаться', { exact: true })).toBeVisible();
  });
});

test.describe('admin staging contract', () => {
  test.skip(
    !adminEmail || !adminPassword,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for moderation coverage.',
  );

  test('admin route exposes moderation resources', async ({ page }) => {
    await signIn(page, adminEmail, adminPassword);
    await page.goto('/admin');
    await expect(page.getByText('Модерация', { exact: true })).toBeVisible();
    await expect(page.getByText('Пользователи', { exact: true })).toBeVisible();
    await page.getByText('Посты', { exact: true }).click();
    await expect(page.getByText('Комментарии', { exact: true })).toBeVisible();
    await page.getByText('Журнал', { exact: true }).click();
    await expect(page.getByText('Журнал', { exact: true })).toBeVisible();
  });
});
