import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllDownloadedManga, getDownloadedChapters, deleteChapter, deleteManga, getStorageEstimate } from '../utils/mangaDB';
import Loading from '../components/Loading';

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export default function MangaDownloads() {
  const navigate = useNavigate();
  const [mangaList, setMangaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedManga, setExpandedManga] = useState(null);
  const [chapterMap, setChapterMap] = useState({});
  const [storageInfo, setStorageInfo] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await getAllDownloadedManga();
    setMangaList(list);
    const est = await getStorageEstimate();
    setStorageInfo(est);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleExpand = async (mangaId) => {
    if (expandedManga === mangaId) {
      setExpandedManga(null);
      return;
    }
    setExpandedManga(mangaId);
    if (!chapterMap[mangaId]) {
      const chapters = await getDownloadedChapters(mangaId);
      setChapterMap((prev) => ({ ...prev, [mangaId]: chapters }));
    }
  };

  const handleDeleteChapter = async (chapterId, mangaId) => {
    setDeleting(chapterId);
    await deleteChapter(chapterId);
    // Refresh chapter list
    const chapters = await getDownloadedChapters(mangaId);
    setChapterMap((prev) => ({ ...prev, [mangaId]: chapters }));
    // If no chapters left, refresh entire list
    if (chapters.length === 0) {
      setExpandedManga(null);
      await refresh();
    }
    setDeleting(null);
  };

  const handleDeleteManga = async (mangaId) => {
    setDeleting(`manga:${mangaId}`);
    await deleteManga(mangaId);
    setExpandedManga(null);
    await refresh();
    setDeleting(null);
  };

  const readOffline = (mangaId, chapterId, provider) => {
    navigate(`/manga/read?id=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}&provider=${provider}&offline=1`);
  };

  if (loading) return <Loading text="Loading downloads..." theme="sooramics" />;

  return (
    <div className="manga-downloads-page sooramics-page">
      <div className="manga-dl-header">
        <button className="manga-dl-back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 className="manga-dl-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Downloads
        </h1>
        {storageInfo && storageInfo.usage > 0 && (
          <span className="manga-dl-storage">
            {formatSize(storageInfo.usage)} used
          </span>
        )}
      </div>

      {mangaList.length === 0 ? (
        <div className="manga-dl-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="56" height="56">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <p>Belum ada chapter yang didownload</p>
          <span>Download chapter dari halaman manga untuk baca offline</span>
        </div>
      ) : (
        <div className="manga-dl-list">
          {mangaList.map((manga) => {
            const isExpanded = expandedManga === manga.id;
            const chapters = chapterMap[manga.id] || [];
            const totalSize = chapters.reduce((s, c) => s + (c.totalSize || 0), 0);

            return (
              <div key={manga.id} className={`manga-dl-item ${isExpanded ? 'expanded' : ''}`}>
                <div className="manga-dl-item-header" onClick={() => toggleExpand(manga.id)}>
                  <div className="manga-dl-item-cover">
                    {manga.cover ? (
                      <img src={manga.cover} alt={manga.title} referrerPolicy="no-referrer" />
                    ) : (
                      <div className="manga-dl-item-cover-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="24" height="24">
                          <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="manga-dl-item-info">
                    <h3 className="manga-dl-item-title">{manga.title || 'Unknown'}</h3>
                    <div className="manga-dl-item-meta">
                      <span>{manga.chapters.length} chapter{manga.chapters.length > 1 ? 's' : ''}</span>
                      {totalSize > 0 && <span className="manga-dl-dot">·</span>}
                      {totalSize > 0 && <span>{formatSize(totalSize)}</span>}
                    </div>
                  </div>
                  <svg className={`manga-dl-chevron ${isExpanded ? 'rotated' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>

                {isExpanded && (
                  <div className="manga-dl-chapters">
                    <div className="manga-dl-chapters-actions">
                      <button
                        className="manga-dl-delete-all"
                        disabled={deleting === `manga:${manga.id}`}
                        onClick={(e) => { e.stopPropagation(); handleDeleteManga(manga.id); }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                        Hapus Semua
                      </button>
                    </div>

                    {chapters.sort((a, b) => Number(a.chapterNum || 0) - Number(b.chapterNum || 0)).map((ch) => (
                      <div key={ch.chapterId} className="manga-dl-chapter">
                        <div
                          className="manga-dl-ch-info"
                          onClick={() => readOffline(manga.id, ch.chapterId, ch.provider)}
                        >
                          <span className="manga-dl-ch-num">Ch. {ch.chapterNum || '?'}</span>
                          <span className="manga-dl-ch-title">{ch.title || `Chapter ${ch.chapterNum}`}</span>
                          <span className="manga-dl-ch-meta">
                            {ch.pageCount} hal · {formatSize(ch.totalSize)}
                          </span>
                        </div>
                        <button
                          className="manga-dl-ch-delete"
                          disabled={deleting === ch.chapterId}
                          onClick={(e) => { e.stopPropagation(); handleDeleteChapter(ch.chapterId, manga.id); }}
                        >
                          {deleting === ch.chapterId ? (
                            <div className="manga-dl-spinner" />
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
