function isOpenGame_(game) {
  return game && game.status !== '完了' && game.status !== '中止';
}

function pickNextOpenGame_(games, completedGameId) {
  const list = Array.isArray(games) ? games : [];
  const completedIndex = list.findIndex(
    (game) => String(game.id) === String(completedGameId)
  );

  if (completedIndex >= 0) {
    const next = list.slice(completedIndex + 1).find(isOpenGame_);
    if (next) return next;
  }

  return list.find(isOpenGame_) || null;
}

function projectReceipts_(rows, selectedGameId) {
  const active = [];
  const cancelled = [];
  const byPlayer = {};

  (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row[1]) === String(selectedGameId) && row[0])
    .filter((row) => String(row[7]) === '有効' || String(row[7]) === '取消')
    .forEach((row) => {
      const receipt = {
        id: String(row[0]),
        gameId: String(row[1]),
        playerId: String(row[2]),
        name: String(row[3] || ''),
        receivedAt: row[4],
        amount: Number(row[5] || 0),
        method: String(row[6] || ''),
        status: String(row[7] || ''),
        memo: String(row[8] || ''),
      };

      if (!byPlayer[receipt.playerId]) byPlayer[receipt.playerId] = [];
      byPlayer[receipt.playerId].push(receipt);
      if (receipt.status === '取消') cancelled.push(receipt);
      else active.push(receipt);
    });

  return { active, cancelled, byPlayer };
}
