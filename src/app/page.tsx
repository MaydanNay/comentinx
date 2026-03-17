"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { extractVideoId } from "@/lib/utils";

const Tooltip = ({ text }: { text: string }) => (
  <div className={styles.tooltipWrapper}>
    <div className={styles.tooltipIcon}>i</div>
    <div className={styles.tooltipContent}>{text}</div>
  </div>
);

export default function Home() {
  const router = useRouter();
  const [games, setGames] = useState<any[]>([]);
  const [expanded, setExpanded] = useState({ time: true, validation: false, prizes: false });
  const [videoId, setVideoId] = useState("");
  const [videoMetadata, setVideoMetadata] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [keywords, setKeywords] = useState<string[]>([""]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const statusMap: Record<string, string> = {
    "WAITING": "В ожидании",
    "ACTIVE": "Идет игра",
    "FINISHED": "Завершена"
  };

  useEffect(() => {
    const videoIdClean = extractVideoId(videoId);
    if (videoIdClean && videoIdClean.length === 11) {
      fetch(`/api/youtube/metadata?videoId=${videoIdClean}`)
        .then(res => res.json())
        .then(data => setVideoMetadata(data))
        .catch(() => setVideoMetadata(null));
    } else {
      setVideoMetadata(null);
    }
  }, [videoId]);

  useEffect(() => {
    const saved = localStorage.getItem("comentix_auth");
    if (saved === "true") setIsAuthenticated(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setIsAuthenticated(true);
      localStorage.setItem("comentix_auth", "true");
      localStorage.setItem("comentix_auth_token", password);
    } else {
      setAuthError("Неверный пароль");
    }
  };

  const toggle = (section: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (document.activeElement?.getAttribute('type') === 'number') {
        (document.activeElement as HTMLInputElement).blur();
      }
    };
    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    fetch("/api/games")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setGames(data);
        } else {
          console.error("Expected array from /api/games, got:", data);
          setGames([]);
        }
      })
      .catch(err => {
        console.error("Fetch games fail:", err);
        setGames([]);
      });
  }, []);

  const currentVideoId = videoId ? extractVideoId(videoId) : "";
  const hasValidVideoId = currentVideoId && currentVideoId.length === 11;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className="premium-gradient">Comentix</h1>
        <p>The ultimate YouTube comment battle platform. Last valid comment wins the prize!</p>
      </header>

      {openMenuId && <div className={styles.menuOverlay} onClick={() => setOpenMenuId(null)} />}

      <div className={styles.container}>
        {!isAuthenticated ? (
          <section className={`${styles.hero} glass-card`} style={{ maxWidth: '400px', margin: '0 auto' }}>
            <h2 className="premium-gradient">Вход для сотрудников</h2>
            <form onSubmit={handleLogin} className={styles.form}>
              <div className={styles.inputGroup}>
                <label>Введите пароль администратора</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className={styles.input}
                  placeholder="Пароль..."
                />
              </div>
              {authError && <p style={{ color: 'hsl(var(--error))', fontSize: '0.8rem' }}>{authError}</p>}
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>Войти</button>
            </form>
          </section>
        ) : (
          <section className={`${styles.hero} glass-card`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="premium-gradient" style={{ margin: 0 }}>Создать новую игру</h2>
              <button 
                onClick={() => {
                  setIsAuthenticated(false);
                  localStorage.removeItem("comentix_auth");
                  localStorage.removeItem("comentix_auth_token");
                }}
                className={styles.logoutBtn}
              >
                Выйти
              </button>
            </div>
            <form className={styles.form} onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              
              const res = await fetch("/api/games", {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  "Authorization": localStorage.getItem("comentix_auth_token") || ""
                },
                body: JSON.stringify({ 
                  ...data, 
                  keywords: keywords.filter(k => k.trim() !== ""),
                  includeOldComments: formData.get("includeOldComments") === "on"
                }),
              });

              if (res.status === 401) {
                setIsAuthenticated(false);
                localStorage.removeItem("comentix_auth");
                localStorage.removeItem("comentix_auth_token");
                alert("Сессия истекла или неверный пароль. Пожалуйста, войдите снова.");
              } else if (res.ok) {
                const game = await res.json();
                if (game && game.id) {
                  router.push(`/games/${game.id}`);
                } else {
                  window.location.reload();
                }
              } else {
                alert("Не удалось создать игру. Проверьте данные.");
              }
            }}>
              {hasValidVideoId && (
                <div className={styles.videoPreviewContainer}>
                  <div className={styles.videoPreview}>
                    <img src={`https://img.youtube.com/vi/${currentVideoId}/maxresdefault.jpg`} alt="Preview" onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${currentVideoId}/0.jpg`;
                    }} />
                  </div>
                  {videoMetadata && (
                    <div className={styles.videoMetaOverlay}>
                      <h3 className={styles.previewTitle}>{videoMetadata.title}</h3>
                      <div className={styles.previewStats}>
                        <span>👁️ {Number(videoMetadata.viewCount).toLocaleString()}</span>
                        <span>❤️ {Number(videoMetadata.likeCount).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <input 
                  name="videoId" 
                  placeholder="Вставьте ссылку на YouTube видео или Shorts" 
                  required 
                  className={styles.input} 
                  onChange={(e) => setVideoId(e.target.value)}
                  value={videoId}
              />
              
              <div className={styles.grid}>
                <div className={styles.collapsibleSection}>
                  <button type="button" className={styles.sectionHeader} onClick={() => toggle('time')}>
                    <h4 className={styles.sectionTitle}>Параметры времени</h4>
                    <span className={`${styles.chevron} ${expanded.time ? styles.chevronExpanded : ""}`}>▼</span>
                  </button>
                  {expanded.time && (
                    <div className={styles.sectionContent}>
                      <div className={styles.inputGroup}>
                        <label>
                          Базовый таймер (сек)
                          <Tooltip text="Время, которое дается после каждого валидного комментария." />
                        </label>
                        <input name="baseTimer" type="number" defaultValue="300" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>
                          Период тишины (сек)
                          <Tooltip text="Если за это время никто не напишет, игра закончится." />
                        </label>
                        <input name="silencePeriod" type="number" defaultValue="300" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>
                          Продление (сек)
                          <Tooltip text="Сколько секунд добавляется к таймеру при новом комментарии." />
                        </label>
                        <input name="prolongTime" type="number" defaultValue="60" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>
                          Антиспам (мин)
                          <Tooltip text="Минимальный интервал между сообщениями от одного пользователя." />
                        </label>
                        <input name="antiSpamConfig" type="number" defaultValue="1" className={styles.input} />
                      </div>
                    </div>
                  )}
                </div>
  
                <div className={styles.collapsibleSection}>
                  <button type="button" className={styles.sectionHeader} onClick={() => toggle('validation')}>
                    <h4 className={styles.sectionTitle}>Правила валидации</h4>
                    <span className={`${styles.chevron} ${expanded.validation ? styles.chevronExpanded : ""}`}>▼</span>
                  </button>
                  {expanded.validation && (
                    <div className={styles.sectionContent}>
                      <div className={styles.inputGroup}>
                        <label>
                          Мин. слов
                          <Tooltip text="Минимальное количество слов в комментарии." />
                        </label>
                        <input name="minWords" type="number" defaultValue="1" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>
                          Мин. символов
                          <Tooltip text="Минимальное количество символов (без пробелов)." />
                        </label>
                        <input name="minChars" type="number" defaultValue="3" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>
                          Мин. предложений
                          <Tooltip text="Минимум знаков препинания (точек, !?) в тексте." />
                        </label>
                        <input name="minSentences" type="number" defaultValue="1" className={styles.input} />
                      </div>

                      <div className={styles.inputGroup} style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <div className={styles.checkboxWrapper}>
                          <input name="includeOldComments" type="checkbox" id="includeOldComments" />
                          <label htmlFor="includeOldComments">
                            Учитывать старые комментарии
                            <Tooltip text="Если включено, система засчитает комментарии, оставленные до создания игры." />
                          </label>
                        </div>
                      </div>
                      
                      <div className={styles.inputGroup} style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            Ключевые слова
                            <Tooltip text="Список слов, хотя бы одно из которых должно быть в тексте." />
                          </span>
                          <button 
                            type="button" 
                            onClick={() => setKeywords([...keywords, ""])}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                            className="btn-primary"
                          >
                            + Добавить слово
                          </button>
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                          {keywords.map((kw, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.25rem' }}>
                              <input 
                                value={kw}
                                onChange={(e) => {
                                  const newKws = [...keywords];
                                  newKws[idx] = e.target.value;
                                  setKeywords(newKws);
                                }}
                                className={styles.input}
                                placeholder="Слово..."
                                style={{ width: '220px' }}
                              />
                              {keywords.length > 1 && (
                                <button 
                                  type="button" 
                                  onClick={() => setKeywords(keywords.filter((_, i) => i !== idx))}
                                  style={{ padding: '0 0.5rem', background: 'rgba(255,0,0,0.1)', color: 'red', border: '1px solid rgba(255,0,0,0.2)', borderRadius: '4px' }}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <p style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.5rem' }}>
                          Если пусто — проверяться не будут. Иначе комментарий должен содержать хотя бы одно слово из списка.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
  
                <div className={styles.collapsibleSection}>
                  <button type="button" className={styles.sectionHeader} onClick={() => toggle('prizes')}>
                    <h4 className={styles.sectionTitle}>Призы</h4>
                    <span className={`${styles.chevron} ${expanded.prizes ? styles.chevronExpanded : ""}`}>▼</span>
                  </button>
                  {expanded.prizes && (
                    <div className={styles.sectionContent}>
                      <div className={styles.inputGroup}>
                        <label>
                          Победителей "Последних N"
                          <Tooltip text="Количество последних комментаторов для утешительного приза." />
                        </label>
                        <input name="lastNCount" type="number" defaultValue="3" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>
                          Пул рандома "Первых N"
                          <Tooltip text="Количество первых участников для розыгрыша случайного приза." />
                        </label>
                        <input name="firstNCount" type="number" defaultValue="10" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>
                          Главный приз
                          <Tooltip text="Описание главного приза для победителя." />
                        </label>
                        <input name="prizeMain" placeholder="Напр: $100" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>
                          Приз "Последние N"
                          <Tooltip text="Приз для тех, кто был близок к победе." />
                        </label>
                        <input name="prizeLastN" placeholder="Напр: $10" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>
                          Приз "Первые N"
                          <Tooltip text="Приз для случайного человека из первой десятки участников." />
                        </label>
                        <input name="prizeFirstN" placeholder="Напр: $5" className={styles.input} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
  
              <button type="submit" className="btn-primary">Запустить Ожидание</button>
            </form>
          </section>
        )}

        <section className={styles.recent}>
          <h2>Недавние игры</h2>
          <div className={styles.gameList}>
            {games.map((game) => (
              <div key={game.id} className={styles.cardWrapper}>
                <a href={`/games/${game.id}`} className={`${styles.gameCard} glass-card ${game.isPinned ? styles.pinnedCard : ""}`} style={{ position: 'relative' }}>
                  {game.isPinned && <div className={styles.pinIndicator}>📌</div>}
                  <div className={styles.gameInfo}>
                    <div className={styles.titleWrapper}>
                      <h3 className={styles.videoTitle}>{game.videoTitle || "Untitled Video"}</h3>
                      <span className={styles.videoIdSmall}>ID: {game.videoId}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                      <span className={`${styles.status} ${styles[game.status.toLowerCase()]}`}>
                        {statusMap[game.status] || game.status}
                      </span>
                      {game.prizeMain && <span className={styles.prizeBadge} title={`Приз: ${game.prizeMain}`}>🎁</span>}
                    </div>
                  </div>
                  <div className={styles.gameStatsMini}>
                      {game.viewCount && <span>👁️ {Number(game.viewCount).toLocaleString()}</span>}
                      {game.likeCount && <span>❤️ {Number(game.likeCount).toLocaleString()}</span>}
                  </div>
                  <div className={styles.gameMeta}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span>{new Date(game.createdAt).toLocaleDateString()}</span>
                      {game.winners && game.winners.find((w:any) => w.category === 'MAIN') && (
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))', fontWeight: 600 }}>
                          🏆 {game.winners.find((w:any) => w.category === 'MAIN').userName}
                        </span>
                      )}
                    </div>
                    <span>{game.status === 'FINISHED' ? 'Completed' : 'Live'}</span>
                  </div>
                </a>

                <div className={styles.menuContainer}>
                  <button 
                    className={styles.menuBtn} 
                    onClick={() => setOpenMenuId(openMenuId === game.id ? null : game.id)}
                  >
                    ⋮
                  </button>
                  {openMenuId === game.id && (
                    <div className={styles.dropdown}>
                      <button onClick={() => router.push(`/games/${game.id}`)}>Открыть</button>
                      <button onClick={async () => {
                        const token = localStorage.getItem("comentix_auth_token");
                        await fetch(`/api/games/${game.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', 'Authorization': token || "" },
                          body: JSON.stringify({ isPinned: !game.isPinned })
                        });
                        window.location.reload();
                      }}>
                        {game.isPinned ? 'Открепить' : 'Закрепить'}
                      </button>
                      <button 
                        className={styles.deleteBtn}
                        onClick={async () => {
                          if (confirm('Удалить эту игру и всю её историю?')) {
                            const token = localStorage.getItem("comentix_auth_token");
                            await fetch(`/api/games/${game.id}`, {
                              method: 'DELETE',
                              headers: { 'Authorization': token || "" }
                            });
                            window.location.reload();
                          }
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {games.length === 0 && <p className={styles.empty}>Никаких игр еще не создано. Будьте первым!</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
