"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { extractVideoId } from "@/lib/utils";

export default function Home() {
  const [games, setGames] = useState<any[]>([]);
  const [expanded, setExpanded] = useState({ time: true, validation: false, prizes: false });
  const [videoId, setVideoId] = useState("");
  const [videoMetadata, setVideoMetadata] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");

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
            <form className={styles.form} onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              fetch("/api/games", {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  "Authorization": localStorage.getItem("comentix_auth_token") || ""
                },
                body: JSON.stringify(data),
              }).then((res) => {
                if (res.status === 401) {
                  setIsAuthenticated(false);
                  localStorage.removeItem("comentix_auth");
                  localStorage.removeItem("comentix_auth_token");
                  alert("Сессия истекла или неверный пароль. Пожалуйста, войдите снова.");
                } else {
                  window.location.reload();
                }
              });
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
                        <label>Базовый таймер (сек)</label>
                        <input name="baseTimer" type="number" defaultValue="300" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Период тишины (сек)</label>
                        <input name="silencePeriod" type="number" defaultValue="300" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Продление (сек)</label>
                        <input name="prolongTime" type="number" defaultValue="60" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Антиспам (мин)</label>
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
                        <label>Мин. слов</label>
                        <input name="minWords" type="number" defaultValue="3" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Мин. символов</label>
                        <input name="minChars" type="number" defaultValue="10" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Мин. предложений</label>
                        <input name="minSentences" type="number" defaultValue="1" className={styles.input} />
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
                        <label>Победителей "Последних N"</label>
                        <input name="lastNCount" type="number" defaultValue="3" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Пул рандома "Первых N"</label>
                        <input name="firstNCount" type="number" defaultValue="10" className={styles.input} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Главный приз</label>
                        <input name="prizeMain" placeholder="Напр: $100" className={styles.input} />
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
              <a href={`/games/${game.id}`} key={game.id} className={`${styles.gameCard} glass-card`}>
                <div className={styles.gameInfo}>
                  <div className={styles.titleWrapper}>
                    <h3 className={styles.videoTitle}>{game.videoTitle || "Untitled Video"}</h3>
                    <span className={styles.videoIdSmall}>ID: {game.videoId}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`${styles.status} ${styles[game.status.toLowerCase()]}`}>
                      {game.status}
                    </span>
                    {game.prizeMain && <span className={styles.prizeBadge}>🎁 {game.prizeMain}</span>}
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
            ))}
            {games.length === 0 && <p className={styles.empty}>Никаких игр еще не создано. Будьте первым!</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
