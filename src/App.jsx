import { useState, useEffect } from "react";
import { 
  collection, addDoc, onSnapshot, query, orderBy, 
  doc, deleteDoc, setDoc, getDoc 
} from "firebase/firestore";
import { db } from "./firebase";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
  return (
    <text x={x} y={y} fill="#333" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: '10px', fontWeight: 'bold' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function App() {
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState("食品");
  const [items, setItems] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [monthlyBudget, setMonthlyBudget] = useState(60000);
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [tempBudget, setTempBudget] = useState("");
  
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  // 1. 実績データ（明細）のリアルタイム取得
  useEffect(() => {
    const q = query(collection(db, "kakeibo"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setItems(data || []);
    });
    return () => unsubscribe();
  }, []);

  // 2. 選択された年月に応じた「予算」の取得
  useEffect(() => {
    const fetchBudget = async () => {
      const budgetId = `budget_${selectedYear}_${selectedMonth}`;
      try {
        const budgetDoc = await getDoc(doc(db, "settings", budgetId));
        if (budgetDoc.exists()) {
          const val = budgetDoc.data().value;
          setMonthlyBudget(val);
          setTempBudget(val);
        } else {
          // 予算が未設定の月は、デフォルト値を表示
          setMonthlyBudget(90000);
          setTempBudget(90000);
        }
      } catch (e) { console.error(e); }
    };
    fetchBudget();
  }, [selectedYear, selectedMonth]);

  // 16日始まりの期間計算
  const getPeriod = (year, month) => {
    const start = new Date(year, month - 2, 16, 0, 0, 0);
    const end = new Date(year, month - 1, 15, 23, 59, 59);
    return { start, end };
  };

  const currentPeriod = getPeriod(selectedYear, selectedMonth);

  // 3. 選択サイクルのデータ抽出（明細・グラフ・合計用）
  const currentItems = items.filter(item => {
    if (!item.date) return false;
    const itemDate = new Date(item.date);
    return itemDate >= currentPeriod.start && itemDate <= currentPeriod.end;
  });

  const currentTotal = currentItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const remaining = monthlyBudget - currentTotal;

  // カテゴリー別集計（グラフ用）
  const chartData = currentItems.reduce((acc, item) => {
    const found = acc.find((c) => c.name === item.category);
    if (found) { found.value += Number(item.amount); }
    else { acc.push({ name: item.category, value: Number(item.amount) }); }
    return acc;
  }, []);

  const COLORS = ["#FF8042", "#0088FE", "#00C49F", "#FFBB28", "#84d8ff", "#8884d8"];

  // 4. 月別予算の保存
  const handleUpdateBudget = async () => {
    if (!tempBudget) return;
    const budgetId = `budget_${selectedYear}_${selectedMonth}`;
    await setDoc(doc(db, "settings", budgetId), { value: Number(tempBudget) });
    setMonthlyBudget(Number(tempBudget));
    setIsSettingOpen(false);
    alert(`${selectedMonth}月サイクルの予算を保存しました！`);
  };

  const handleAdd = async () => {
    if (!amount) return;
    await addDoc(collection(db, "kakeibo"), { amount: Number(amount), memo, category, date });
    setAmount(""); setMemo("");
  };

  const deleteItem = async (id) => {
    if (!window.confirm("削除しますか？")) return;
    await deleteDoc(doc(db, "kakeibo", id));
  };

  return (
    <div style={{ width: "100%", maxWidth: "480px", margin: "0 auto", padding: "12px", fontFamily: "sans-serif", backgroundColor: '#fdfdfd', minHeight: '100vh' }}>
      <header style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
        <img src="/icon.png" alt="logo" style={{ width: '32px', height: '32px', borderRadius: '6px', marginRight: '10px' }} />
        <h1 style={{ fontSize: '18px', margin: 0 }}>My Kakeibo</h1>
        <button onClick={() => setIsSettingOpen(!isSettingOpen)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '20px' }}>⚙️</button>
      </header>

      {/* 月選択エリア */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff', padding: '10px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>表示月:</span>
        <select 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(Number(e.target.value))} 
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #eee', fontSize: '14px' }}
        >
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
            <option key={m} value={m}>{m}月サイクル (前月16日〜)</option>
          ))}
        </select>
      </div>

      {isSettingOpen && (
        <div style={{ padding: "16px", backgroundColor: "#fff", borderRadius: "12px", marginBottom: "16px", border: '2px solid #007bff' }}>
          <label style={{fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px'}}>{selectedMonth}月の基本予算を設定</label>
          <input type="number" value={tempBudget} onChange={(e) => setTempBudget(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #ddd' }} />
          <button onClick={handleUpdateBudget} style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>この月の予算を確定</button>
        </div>
      )}

      {/* サマリーカード */}
      <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "16px", boxShadow: "0 4px 15px rgba(0,0,0,0.08)", marginBottom: "20px", borderLeft: '6px solid #007bff' }}>
        <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
          期間: {currentPeriod.start.toLocaleDateString()} 〜 {currentPeriod.end.toLocaleDateString()}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span>設定予算:</span> <span>{monthlyBudget.toLocaleString()}円</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <strong>支出合計:</strong> <strong>{currentTotal.toLocaleString()}円</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
          <span style={{ fontWeight: 'bold' }}>今月の残り:</span>
          <span style={{ fontSize: '1.4em', fontWeight: 'bold', color: remaining < 0 ? '#dc3545' : '#28a745' }}>
            {remaining.toLocaleString()}円
          </span>
        </div>
      </div>

      {/* グラフエリア */}
      {chartData.length > 0 && (
        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
          <h3 style={{ textAlign: 'center', fontSize: '14px', margin: '0 0 15px 0', color: '#666' }}>{selectedMonth}月の支出内訳</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" label={renderCustomizedLabel}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v.toLocaleString()}円`} />
              <Legend verticalAlign="bottom" wrapperStyle={{fontSize: '11px', paddingTop: '10px'}} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 入力フォーム */}
      <div style={{ backgroundColor: "#f0f2f5", padding: "16px", borderRadius: "16px", marginBottom: "20px" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input type="number" placeholder="金額" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: 1.5, padding: '12px', borderRadius: '10px', border: '1px solid #ddd', backgroundColor: '#fff' }}>
            <option value="食品">食品</option><option value="日用品">日用品</option><option value="外食">外食</option>
            <option value="光熱費">光熱費</option><option value="こたちゃん">こたちゃん</option><option value="その他">その他</option>
          </select>
        </div>
        <input placeholder="メモ" value={memo} onChange={(e) => setMemo(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <button onClick={handleAdd} style={{ width: '100%', padding: '14px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 6px rgba(0,123,255,0.2)' }}>支出を追加</button>
      </div>

      {/* 明細一覧 */}
      <div style={{ marginTop: '20px' }}>
        <h3 style={{ fontSize: '15px', color: '#555', borderLeft: '4px solid #007bff', paddingLeft: '10px', marginBottom: '12px' }}>
          {selectedMonth}月サイクルの明細 ({currentItems.length}件)
        </h3>
        {currentItems.length > 0 ? (
          currentItems.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 12px', backgroundColor: '#fff', borderRadius: '12px', marginBottom: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>{item.date?.replace(/-/g, "/")}</span>
                <span style={{ fontSize: '15px', fontWeight: '500' }}>{item.category} <span style={{ color: '#999', fontSize: '12px', fontWeight: 'normal' }}>{item.memo ? `(${item.memo})` : ''}</span></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <strong style={{ fontSize: '16px', color: '#333' }}>{Number(item.amount).toLocaleString()}円</strong>
                <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#eee', cursor: 'pointer' }}>🗑️</button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>この期間の明細はありません。</div>
        )}
      </div>
    </div>
  );
}