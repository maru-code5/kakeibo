// （中略：インポート部分はそのまま）

export default function App() {
  // （中略：ステート部分はそのまま）

  // 💰 計算ロジック（修正版）
  const getSum = (period) => {
    return items.reduce((sum, item) => {
      if (!item.date) return sum;
      const itemDate = new Date(item.date);
      if (itemDate >= period.start && itemDate <= period.end) {
        return sum + (Number(item.amount) || 0);
      }
      return sum;
    }, 0);
  };

  const currentTotal = getSum(todayPeriod);
  const lastTotal = getSum(lastPeriod);

  // 🛡️ 初回判定：前期間（1/16〜2/15）にデータが3件未満なら、
  // まだ管理が始まっていないとみなして繰り越しを0円にする
  const lastPeriodCount = items.filter(item => {
    const d = new Date(item.date);
    return d >= lastPeriod.start && d <= lastPeriod.end;
  }).length;

  const carryOver = lastPeriodCount < 3 ? 0 : (monthlyBudget - lastTotal);
  
  const remaining = (monthlyBudget + carryOver) - currentTotal;

  // （以下、表示部分はそのまま）