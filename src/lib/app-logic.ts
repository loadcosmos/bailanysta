export type Locale = 'ru' | 'kk';

type SearchablePost = {
  author: { name: string; handle: string };
  body: string;
  topic: string;
  tags: string[];
};

export function filterPosts<T extends SearchablePost>(posts: T[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return posts;

  return posts.filter((post) =>
    [post.body, post.topic, post.author.name, post.author.handle, ...post.tags]
      .join(' ')
      .toLocaleLowerCase()
      .includes(needle),
  );
}

export function getCopy(copy: { ru: string; kk?: string }, locale: Locale) {
  return locale === 'kk' && copy.kk ? copy.kk : copy.ru;
}

export function canUseMemberAction(accessToken?: string) {
  return Boolean(accessToken?.trim());
}

export function feedFailurePosts<T>(remote: boolean, cached: T[], demo: T[]) {
  return remote ? cached : demo;
}

export function feedEmptyCopy(locale: Locale) {
  return locale === 'kk'
    ? { title: 'Әзірге тыныш', text: 'Өсу сигналыңызбен бірінші болып бөлісіңіз.' }
    : { title: 'Пока тихо', text: 'Станьте первым, кто поделится сигналом роста.' };
}

export function appendUnique<T extends { id: string }>(current: T[], next: T[]) {
  const known = new Set(current.map((item) => item.id));
  return next.reduce<T[]>((items, item) => {
    if (!known.has(item.id)) {
      known.add(item.id);
      items.push(item);
    }
    return items;
  }, [...current]);
}

export function upsertById<T extends { id: string }>(current: T[], next: T) {
  const index = current.findIndex((item) => item.id === next.id);
  if (index < 0) return [next, ...current];
  return current.map((item, itemIndex) => (itemIndex === index ? next : item));
}
