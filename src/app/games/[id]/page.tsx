"use client";

import { useEffect, useState, use } from "react";
import styles from "./game.module.css";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [game, setGame] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});

  const toggleReason = (commentId: string) => {
    setExpandedReasons(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const exportToExcel = () => {
    if (!game || !game.winners || game.winners.length === 0) return;
    
    // Create an HTML table structure that Excel understands
    const headers = ["Категория", "Имя участника", "YouTube ID", "Ссылка на комментарий"];
    const rows = game.winners.map((w: any) => [
      w.category === "MAIN" ? "ГЛАВНЫЙ" : 
      w.category === "LAST_N" ? `ПОСЛЕДНИЙ ${game.lastNCount}` : `РАНДОМ ПЕРВЫХ ${game.firstNCount}`,
      w.userName,
      w.userId,
      w.commentId ? `https://www.youtube.com/watch?v=${game.videoId}&lc=${w.commentId}` : ""
    ]);

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Winners</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head>
      <body>
        <table border="1">
          <thead>
            <tr style="background-color: #f3f4f6; font-weight: bold;">
              ${headers.map(h => `<th style="padding: 10px;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row: any[]) => `
              <tr>
                ${row.map(cell => `<td style="padding: 8px;">${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comentix_winners_${game.videoId}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/games/${id}/poll`, { method: "POST" });
        const data = await res.json();
        setGame(data);
        if (data.timeLeft !== undefined) setTimeLeft(data.timeLeft);
      } catch (err) {
        console.error("Poll fail", err);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (timeLeft === null || timeLeft === 0 || game?.status !== "ACTIVE") return;

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, game?.status]);

  if (!game) return <div className={styles.loading}>Загрузка игры...</div>;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <main className={styles.gameContainer}>
      <div className={styles.mainContent}>
        <section className={`${styles.timerCard} glass-card animate-fade-in`}>
          <div className={styles.videoHeaderMini}>
            <h1 className={styles.videoTitleMain}>{game.videoTitle || "Загрузка названия..."}</h1>
            <div className={styles.videoStatsRow}>
              <span>👁️ {Number(game.viewCount || 0).toLocaleString()}</span>
              <span>❤️ {Number(game.likeCount || 0).toLocaleString()}</span>
              <span className={styles.videoIdBadge}>ID: {game.videoId}</span>
            </div>
          </div>
          <div className={styles.timerDivider}></div>
          <p className={styles.timerLabel}>{game.status === 'WAITING' ? 'Ожидание первого комментария' : 'До завершения игры'}</p>
          <div className={`${styles.timeLeft} ${timeLeft !== null && timeLeft < 60 ? styles.pulse : ""}`}>
            {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
          </div>
        </section>

        <section className={`${styles.commentsSection} glass-card`}>
          <h2>
            <div className={styles.liveIndicator}></div>
            Лента комментариев
          </h2>
          <div className={styles.commentList}>
            {game.comments?.map((c: any) => (
              <div 
                key={c.id} 
                className={`${styles.comment} glass-card ${c.status === "INVALID" ? styles.invalid : ""}`}
                onClick={() => c.status === "INVALID" && toggleReason(c.id)}
                style={{ cursor: c.status === "INVALID" ? "help" : "default" }}
              >
                <img src={c.userProfilePic} alt={c.userName} className={styles.avatar} />
                <div className={styles.commentBody}>
                  <div className={styles.commentHead}>
                    <span className={styles.author}>{c.userName}</span>
                    <div className={styles.commentMeta}>
                      <span className={styles.time}>{new Date(c.timestamp).toLocaleTimeString()}</span>
                      <a href={`https://www.youtube.com/watch?v=${game.videoId}&lc=${c.commentId}`} target="_blank" className={styles.ytLink} title="На YouTube" onClick={(e) => e.stopPropagation()}>↗</a>
                    </div>
                  </div>
                  <p className={styles.text}>{c.text}</p>
                  {c.status === "INVALID" && (
                      <div className={styles.reasonWrapper}>
                        <div className={styles.reasonHint}>⚠️ Нажмите, чтобы узнать причину</div>
                        {expandedReasons[c.id] && (
                            <div className={styles.reason} style={{ marginTop: '0.5rem', color: 'hsl(var(--error))', fontSize: '0.8rem', fontWeight: 600 }}>
                                ❌ {c.invalidReason}
                            </div>
                        )}
                      </div>
                  )}
                </div>
              </div>
            ))}
            {(!game.comments || game.comments.length === 0) && <p className={styles.empty}>Здесь пусто... Будьте первым, кто напишет!</p>}
          </div>
        </section>
      </div>

      <aside className={`${styles.sidebar} animate-fade-in`}>
        <div className={`${styles.sidebarCard} glass-card`}>
          <h2>🏆 Призовой фонд</h2>
          <div className={styles.prizesBox}>
              <div className={styles.prizeItem}>
                  <span className={styles.cat}>Главный приз</span>
                  <span className={styles.val}>{game.prizeMain || "—"}</span>
              </div>
              <div className={styles.prizeItem}>
                  <span className={styles.cat}>Последние {game.lastNCount}</span>
                  <span className={styles.val}>{game.prizeLastN || "—"}</span>
              </div>
              <div className={styles.prizeItem}>
                  <span className={styles.cat}>Рандом первых {game.firstNCount}</span>
                  <span className={styles.val}>{game.prizeFirstN || "—"}</span>
              </div>
          </div>

          {game.winners && game.winners.length > 0 && (
            <div className={styles.winnersBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
                    <h2 style={{ margin: 0 }}>🎉 Победители</h2>
                    <button 
                        onClick={exportToExcel}
                        className={styles.exportBtn}
                    >
                        Скачать Excel
                    </button>
                </div>
                {game.winners.map((w: any) => (
                  <div key={w.id} className={styles.winnerItem}>
                    <div className={styles.winnerContent}>
                        <span className={styles.cat}>{
                            w.category === "MAIN" ? "ГЛАВНЫЙ" : 
                            w.category === "LAST_N" ? `ПОСЛЕДНИЙ ${game.lastNCount}` : `РАНДОМ ПЕРВЫХ ${game.firstNCount}`
                        }</span>
                        <a 
                            href={`https://www.youtube.com/channel/${w.userId}`} 
                            target="_blank" 
                            className={styles.winnerName}
                        >
                            @{w.userName}
                        </a>
                        {w.commentId && (
                            <a 
                                href={`https://www.youtube.com/watch?v=${game.videoId}&lc=${w.commentId}`} 
                                target="_blank" 
                                className={styles.winnerCommentLink}
                            >
                                Посмотреть комментарий ↗
                            </a>
                        )}
                    </div>
                  </div>
                ))}
                <p style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginTop: '1rem', fontStyle: 'italic' }}>
                    * Победители зафиксированы. Вы можете вручную уведомить их, перейдя по ссылке на их комментарии.
                </p>
            </div>
          )}
        </div>

        <div className={`${styles.sidebarCard} glass-card`}>
          <h2>👥 Участники</h2>
          <div className={styles.miniList}>
            {game.comments?.filter((c:any) => c.status === "VALID").slice(0, 15).map((c: any) => (
              <div key={c.id} className={styles.miniItem}>
                <img src={c.userProfilePic} className={styles.miniAvatar} />
                <span style={{ fontSize: '0.9rem' }}>{c.userName}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${styles.sidebarCard} glass-card`}>
          <h2>📜 Правила</h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>
            <li>• Минимум {game.minWords} слов / {game.minChars} символов</li>
            <li>• Антиспам: {game.antiSpamConfig} мин между постами</li>
            <li>• Пауза {game.silencePeriod} сек завершит игру</li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
