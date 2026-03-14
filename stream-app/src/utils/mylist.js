// My List - localStorage-backed watchlist
const STORAGE_KEY = 'ameflix_mylist';

const getList = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveList = (list) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('mylist-changed'));
};

export const addToMyList = (item) => {
  const list = getList();
  if (list.some((i) => i.id === item.id && i.listType === item.listType)) return;
  list.unshift({
    id: item.id,
    title: item.title,
    image: item.image,
    type: item.type || '',
    listType: item.listType, // 'anime' or 'movie'
    mediaType: item.mediaType || '',
    tmdbId: item.tmdbId || null,
    rating: item.rating || null,
    releaseDate: item.releaseDate || '',
    addedAt: Date.now(),
  });
  saveList(list);
};

export const removeFromMyList = (id, listType) => {
  const list = getList().filter(
    (i) => !(i.id === id && i.listType === listType)
  );
  saveList(list);
};

export const isInMyList = (id, listType) => {
  return getList().some((i) => i.id === id && i.listType === listType);
};

export const getMyList = () => getList();

export const getMyListCount = () => getList().length;
