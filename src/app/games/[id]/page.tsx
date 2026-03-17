"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import styles from "./game.module.css";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [game, setGame] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [clockOffset, setClockOffset] = useState<number>(0);
  const [prolongAmount, setProlongAmount] = useState<number>(10);
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});

  const toggleReason = (commentId: string) => {
    setExpandedReasons(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const exportToExcel = () => {
    if (!game || !game.winners || game.winners.length === 0) return;

    // Create an HTML table structure that Excel understands
    const headers = ["Категория", "Имя участника", "YouTube ID", "Ссылка на комментарий"];
    let lastNIndex = 0;
    const rows = game.winners.map((w: any) => {
      let cat = "";
      if (w.category === "MAIN") cat = "ГЛАВНЫЙ";
      else if (w.category === "LAST_N") {
        lastNIndex++;
        cat = `ПОСЛЕДНИЙ ${lastNIndex}`;
      } else cat = `РАНДОМ ПЕРВЫХ ${game.firstNCount}`;

      return [
        cat,
        w.userName,
        w.userId,
        w.commentId ? `https://www.youtube.com/watch?v=${game.videoId}&lc=${w.commentId}` : ""
      ];
    });

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

  const handleProlongClick = () => {
    if (!game || game.status !== 'ACTIVE') return;
    setShowModal(true);
  };

  const confirmProlong = async () => {
    if (!adminPassword) return;

    try {
      const res = await fetch(`/api/games/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": adminPassword
        },
        body: JSON.stringify({ addSeconds: prolongAmount })
      });

      if (res.ok) {
        const updatedData = await res.json();
        setGame(updatedData);
        if (updatedData.endTime !== undefined) setEndTime(updatedData.endTime);
        setShowModal(false);
        setAdminPassword("");
      } else {
        alert("Ошибка: Неверный пароль или игра неактивна");
      }
    } catch (err) {
      console.error("Prolong error", err);
      alert("Ошибка при продлении");
    }
  };

  const handleEditSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!adminPassword) {
      alert("Введите пароль администратора");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch(`/api/games/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": adminPassword
        },
        body: JSON.stringify({
          ...data,
          includeOldComments: formData.get("includeOldComments") === "on",
          keywords: (data.keywords as string).split(',').map(k => k.trim()).filter(k => k !== ""),
          currency: data.currency
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setGame((prev: any) => ({ ...prev, ...updated }));
        setShowEditModal(false);
        setAdminPassword("");
        alert("Настройки успешно обновлены!");
      } else {
        alert("Ошибка при обновлении. Проверьте пароль.");
      }
    } catch (err) {
      console.error("Edit error", err);
    }
  };

  const cycleProlongAmount = (e: React.MouseEvent) => {
    e.stopPropagation();
    const amounts = [10, 30, 60];
    const currentIndex = amounts.indexOf(prolongAmount);
    setProlongAmount(amounts[(currentIndex + 1) % amounts.length]);
  };

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/games/${id}/poll`, { method: "POST" });
        const data = await res.json();
        setGame(data);
        if (data.serverTime) {
          setClockOffset(data.serverTime - Date.now());
        }
        if (data.endTime !== undefined) setEndTime(data.endTime);
        else if (data.timeLeft !== undefined) setTimeLeft(data.timeLeft);
      } catch (err) {
        console.error("Poll fail", err);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (game?.status !== "ACTIVE") return;

    const timer = setInterval(() => {
      if (endTime) {
        const now = Date.now() + clockOffset;
        const diff = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(diff);
      } else {
        setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, game?.status]);

  if (!game) return <div className={styles.loading}>Загрузка игры...</div>;

  const formatTimeSeconds = (seconds: number) => {
    if (seconds < 60) return `${seconds}с`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}м${s > 0 ? ` ${s}с` : ""}`;
  };

  return (
    <main className={styles.gameContainer}>
      <div className={styles.mainContent}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" className={styles.backLink}>
            ← На главную
          </Link>
          {game.status !== 'FINISHED' && (
            <button className={styles.adminBtn} onClick={() => setShowEditModal(true)}>
              ⚙️ Настроить игру
            </button>
          )}
        </div>
        <section className={`${styles.timerCard} glass-card animate-fade-in`}>
          <div className={styles.videoHeaderMini}>
            <h1 className={styles.videoTitleMain}>
              <a 
                href={`https://www.youtube.com/watch?v=${game.videoId}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.videoTitleLink}
              >
                {game.videoTitle || "Загрузка названия..."}
              </a>
            </h1>
            <div className={styles.videoStatsRow}>
              <span>👁️ {Number(game.viewCount || 0).toLocaleString()}</span>
              <span>❤️ {Number(game.likeCount || 0).toLocaleString()}</span>
              <span className={styles.videoIdBadge}>ID: {game.videoId}</span>
            </div>
          </div>
          <div className={styles.timerDivider}></div>
          <p className={styles.timerLabel}>
            {game.status === 'WAITING' ? 'Ожидание первого комментария' :
              game.status === 'FINISHED' ? 'Игра завершена' : 'До завершения игры'}
          </p>
          <div className={`${styles.timeLeft} ${timeLeft !== null && timeLeft < 60 && game.status === 'ACTIVE' ? styles.pulse : ""}`}>
            {timeLeft !== null ? (timeLeft >= 600 ? formatTimeSeconds(timeLeft) : (
                <>
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </>
            )) : "--:--"}
            {game.status === 'ACTIVE' && (
              <div className={styles.prolongContainer}>
                <button className={styles.prolongBtn} onClick={handleProlongClick} title="Продлить время">
                  + {prolongAmount}с
                </button>
                <button className={styles.cycleBtn} onClick={cycleProlongAmount} title="Изменить время">
                  ↺
                </button>
              </div>
            )}
          </div>
          {game.bonusTime > 0 && (
            <div className={styles.bonusTime}>
              <span className={styles.bonusLabel}>🔥 Бонусное время (от комментов):</span>
              <span className={styles.bonusValue}>+{formatTimeSeconds(game.bonusTime)}</span>
            </div>
          )}
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
            {game.prizeMain && (
                <div className={styles.prizeItem}>
                  <span className={styles.cat}>Главный приз:</span>
                  <span className={styles.val}>{game.prizeMain} {game.currency}</span>
                </div>
            )}
            {game.prizeLastN && (
                <div className={styles.prizeItem}>
                  <span className={styles.cat}>Последних {game.lastNCount}:</span>
                  <span className={styles.val}>{game.prizeLastN} {game.currency}</span>
                </div>
            )}
            {game.prizeFirstN && (
                <div className={styles.prizeItem}>
                  <span className={styles.cat}>Рандом {game.firstNCount}:</span>
                  <span className={styles.val}>{game.prizeFirstN} {game.currency}</span>
                </div>
            )}
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
              {(() => {
                let lastNIndex = 0;
                return game.winners.map((w: any) => {
                  let categoryLabel = "";
                  if (w.category === "MAIN") {
                    categoryLabel = "ГЛАВНЫЙ";
                  } else if (w.category === "LAST_N") {
                    lastNIndex++;
                    categoryLabel = `ПОСЛЕДНИЙ ${lastNIndex}`;
                  } else {
                    categoryLabel = `РАНДОМ ПЕРВЫХ ${game.firstNCount}`;
                  }

                  return (
                    <div key={w.id} className={styles.winnerItem}>
                      <div className={styles.winnerContent}>
                        <span className={styles.cat}>{categoryLabel}</span>
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
                  );
                });
              })()}
              <p style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginTop: '1rem', fontStyle: 'italic' }}>
                * Победители зафиксированы. Вы можете вручную уведомить их, перейдя по ссылке на их комментарии.
              </p>
            </div>
          )}
        </div>

        <div className={`${styles.sidebarCard} glass-card`}>
          <h2>👥 Участники ({game.uniqueParticipantsCount || 0})</h2>
          <div className={styles.miniList}>
            {(() => {
              const uniqueUsers = new Map();
              game.comments?.filter((c: any) => c.status === "VALID").forEach((c: any) => {
                if (!uniqueUsers.has(c.userId)) {
                  uniqueUsers.set(c.userId, c);
                }
              });
              return Array.from(uniqueUsers.values()).slice(0, 15).map((c: any) => (
                <div key={c.id} className={styles.miniItem}>
                  <img src={c.userProfilePic} className={styles.miniAvatar} />
                  <span style={{ fontSize: '0.9rem' }}>{c.userName}</span>
                </div>
              ));
            })()}
          </div>
        </div>

        <div className={`${styles.sidebarCard} glass-card`}>
          <h2>📜 Правила игры</h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'hsl(var(--primary))' }}>•</span>
              Минимальный текст: <strong>{game.minWords} слов / {game.minChars} симв.</strong>
            </li>
            {game.minSentences > 0 && (
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'hsl(var(--primary))' }}>•</span>
                Минимум предложений: <strong>{game.minSentences}</strong>
              </li>
            )}
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'hsl(var(--primary))' }}>•</span>
              Антиспам: <strong>{game.antiSpamConfig} мин.</strong> пауза
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'hsl(var(--primary))' }}>•</span>
              Новый коммент: <strong>+{formatTimeSeconds(game.prolongTime)}</strong> к таймеру
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'hsl(var(--primary))' }}>•</span>
              Тишина <strong>{formatTimeSeconds(game.silencePeriod)}</strong> завершит игру
            </li>
            {game.keywords && JSON.parse(game.keywords).length > 0 && (
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ color: 'hsl(var(--primary))', marginTop: '0.2rem' }}>•</span>
                <span>
                  Нужны слова: <strong style={{ color: 'hsl(var(--text-main))' }}>{JSON.parse(game.keywords).join(', ')}</strong>
                </span>
              </li>
            )}
          </ul>
        </div>
      </aside>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={`${styles.modal} glass-card`} onClick={e => e.stopPropagation()}>
            <h3>🔐 Режим Администратора</h3>
            <p>Введите пароль для продления на {prolongAmount} сек.</p>
            <input 
              type="password" 
              placeholder="Пароль..." 
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmProlong()}
              autoFocus
              className={styles.modalInput}
            />
            <div className={styles.modalActions}>
              <button 
                className={styles.modalCancel} 
                onClick={() => setShowModal(false)}
              >
                Отмена
              </button>
              <button 
                className={styles.modalConfirm} 
                onClick={confirmProlong}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.editModal} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>🛠️ Настройка параметров</h3>
            <form onSubmit={handleEditSave} className={styles.editForm}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Валюта</label>
                  <select name="currency" defaultValue={game.currency} className={styles.select}>
                    <option value="₸">₸ (Тенге)</option>
                    <option value="$">$ (Доллар)</option>
                    <option value="₽">₽ (Рубль)</option>
                    <option value="€">€ (Евро)</option>
                    <option value="₴">₴ (Гривна)</option>
                    <option value="£">£ (Фунт)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Главный приз</label>
                  <input name="prizeMain" defaultValue={game.prizeMain} className={styles.formInput} />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Пароль Админа (для сохранения)</label>
                  <input 
                    type="password" 
                    value={adminPassword} 
                    onChange={e => setAdminPassword(e.target.value)}
                    className={styles.formInput}
                    placeholder="Подтвердите пароль..."
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Последних X (кол-во)</label>
                  <input name="lastNCount" type="number" defaultValue={game.lastNCount} className={styles.formInput} />
                </div>
                <div className={styles.formGroup}>
                  <label>Приз "Последние X"</label>
                  <input name="prizeLastN" defaultValue={game.prizeLastN} className={styles.formInput} />
                </div>

                <div className={styles.formGroup}>
                  <label>Пул рандома "Первых X"</label>
                  <input name="firstNCount" type="number" defaultValue={game.firstNCount} className={styles.formInput} />
                </div>
                <div className={styles.formGroup}>
                  <label>Приз рандома "Первые X"</label>
                  <input name="prizeFirstN" defaultValue={game.prizeFirstN} className={styles.formInput} />
                </div>

                <div className={styles.formGroup}>
                  <label>Продление (сек)</label>
                  <input name="prolongTime" type="number" defaultValue={game.prolongTime} className={styles.formInput} />
                </div>
                <div className={styles.formGroup}>
                  <label>Антиспам (мин)</label>
                  <input name="antiSpamConfig" type="number" defaultValue={game.antiSpamConfig} className={styles.formInput} />
                </div>

                <div className={styles.formGroup}>
                  <label>Мин. слов</label>
                  <input name="minWords" type="number" defaultValue={game.minWords} className={styles.formInput} />
                </div>
                <div className={styles.formGroup}>
                  <label>Мин. символов</label>
                  <input name="minChars" type="number" defaultValue={game.minChars} className={styles.formInput} />
                </div>

                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                  <label>Ключевые слова (через запятую)</label>
                  <input 
                    name="keywords" 
                    defaultValue={game.keywords ? JSON.parse(game.keywords).join(', ') : ""} 
                    className={styles.formInput}
                    placeholder="слово1, слово2..."
                  />
                </div>

                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', textTransform: 'none' }}>
                      <input type="checkbox" name="includeOldComments" defaultChecked={game.includeOldComments} />
                      Учитывать старые комментарии
                   </label>
                </div>
              </div>

              <div className={styles.editActions}>
                <button type="button" className={styles.modalCancel} onClick={() => setShowEditModal(false)}>Отмена</button>
                <button type="submit" className={styles.modalConfirm}>💾 Сохранить изменения</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
