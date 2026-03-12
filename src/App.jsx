import { useState, useEffect } from "react";
import { 
  collection, addDoc, onSnapshot, query, orderBy, 
  doc, deleteDoc, serverTimestamp, setDoc, getDoc 
} from "firebase/firestore";
import { db } from "./firebase";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
  return (
    <text x={x} y={y} fill="#333" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: '12px', fontWeight: 'bold' }}>
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
  
  const [monthlyBudget, setMonthlyBudget] = useState(90000);
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [tempBudget, setTempBudget] = useState("");

  // 📅 今月の年月を取得 (例: "2024-03")
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  // 📅 先月の年月を取得
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // 1. 全データ取得
  useEffect(() => {
    const q = query(collection(db, "kakeibo"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setItems(data);
    });

    const fetchBudget = async () => {
      const budgetDoc = await getDoc(doc(db, "settings", "budget"));
      if (budgetDoc.exists()) {
        setMonthlyBudget(budgetDoc.data().value);
        setTempBudget(budgetDoc.data().value);
      }
    };
    fetchBudget();
    return () => unsubscribe();
  }, []);

  // 💰 計算ロジック
  // 今月の支出合計
  const currentMonthTotal = items
    .filter(item => item.date && item.date.startsWith(currentMonthStr))
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // 先月の支出合計
  const lastMonthTotal = items
    .filter(item => item.date && item.date.startsWith(lastMonthStr))
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // 先月からの繰り越し (先月の予算 - 先月の支出)
  const carryOver = monthlyBudget - lastMonthTotal;
  
  // 今月の実質予算 (設定予算 + 繰り越し)
  const actualBudget = monthlyBudget + carryOver;
  
  // 最終的な残り
  const remaining = actualBudget - currentMonthTotal;

  // グラフ用データ (今月分のみ)
  const chartData = items
    .filter(item => item.date && item.date.startsWith(currentMonthStr))
    .reduce((acc, item) => {
      const found = acc.find((c) => c.name === item.category);
      if (found) { found.value += Number(item.amount); }
      else { acc.push({ name: item.category, value: Number(item.amount) }); }
      return acc;
    }, []);

  const COLORS = ["#FF8042", "#0088FE", "#00C49F", "#FFBB28", "#84d8ff", "#8884d8"];

  const handleUpdateBudget = async () => {
    if (!tempBudget) return;
    try {
      await setDoc(doc(db, "settings", "budget"), { value: Number(tempBudget), updatedAt: serverTimestamp() });
      setMonthlyBudget(Number(tempBudget));
      setIsSettingOpen(false);
      alert("予算を更新しました！");
    } catch (e) { console.error(e); }
  };

  const handleAdd = async () => {
    if (!amount) return;
    try {
      await addDoc(collection(db, "kakeibo"), { amount: Number(amount), memo, category, date, createdAt: serverTimestamp() });
      setAmount(""); setMemo("");
    } catch (e) { console.error(e); }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("この明細を削除しますか？")) return;
    await deleteDoc(doc(db, "kakeibo", id));
  };

  return (
    <div style={styles.container}>
      <header style={headerStyle}>
        <img src="/icon.png" alt="logo" style={{...logoStyle, cursor: 'pointer'}} onClick={() => window.location.reload()} />
        <h1 style={{...titleStyle, cursor: 'pointer'}} onClick={() => window.location.reload()}>My Kakeibo</h1>
        <button onClick={() => setIsSettingOpen(!isSettingOpen)} style={styles.settingBtn}>⚙️</button>
      </header>

      {isSettingOpen && (
        <div style={styles.budgetSettingBox}>
          <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>基本の月間予算</label>
          <input type="number" value={tempBudget} onChange={(e) => setTempBudget(e.target.value)} style={styles.input} />
          <button onClick={handleUpdateBudget} style={styles.saveBtn}>設定保存</button>
        </div>
      )}

      <div style={styles.summaryCard}>
        <div style={styles.summaryRow}><span>基本予算:</span> <span>{monthlyBudget.toLocaleString()}円</span></div>
        <div style={{...styles.summaryRow, color: carryOver >= 0 ? "blue" : "red"}}>
          <span>先月の繰越:</span> <span>{carryOver >= 0 ? "+" : ""}{carryOver.toLocaleString()}円</span>
        </div>
        <hr />
        <div style={styles.summaryRow}><strong>今月の支出:</strong> <strong>{currentMonthTotal.toLocaleString()}円</strong></div>
        <div style={{...styles.summaryRow, fontSize: "1.2em", color: remaining < 0 ? "red" : "green"}}>
          <strong>今月の残り:</strong> <strong>{remaining.toLocaleString()}円</strong>
        </div>
      </div>

      <div style={styles.inputArea}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
        <div style={{display: "flex", gap: "8px"}}>
          <input type="number" placeholder="金額" value={amount} onChange={(e) => setAmount(e.target.value)} style={{...styles.input, flex: 2}} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{...styles.select, flex: 1}}>
            <option value="食品">食品</option>
            <option value="日用品">日用品</option>
            <option value="外食">外食</option>
            <option value="光熱費">光熱費</option>
            <option value="こたちゃん">こたちゃん</option>
            <option value="その他">その他</option>
          </select>
        </div>
        <input placeholder="メモ" value={memo} onChange={(e) => setMemo(e.target.value)} style={styles.input} />
        <button onClick={handleAdd} style={styles.button}>支出を追加</button>
      </div>

      {chartData.length > 0 && (
        <div style={styles.chartContainer}>
          <h3 style={{ textAlign: "center", fontSize: "14px" }}>今月のカテゴリー別</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value" label={renderCustomizedLabel}>
                {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v.toLocaleString()}円`} />
              <Legend iconSize={10} wrapperStyle={{fontSize: "12px"}} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={styles.listContainer}>
        <h3 style={{fontSize: "14px", color: "#666"}}>全履歴</h3>
        {items.slice(0, 10).map((item) => (
          <div key={item.id} style={styles.listItem}>
            <span style={{fontSize: "12px", color: "#888"}}>{item.date?.replace(/-/g, "/")}</span>
            <span>{item.category} / <strong>{item.amount.toLocaleString()}円</strong></span>
            <button onClick={() => deleteItem(item.id)} style={styles.deleteBtn}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { width: "100%", maxWidth: "480px", margin: "0 auto", padding: "16px", fontFamily: "sans-serif", backgroundColor: "#fdfdfd" },
  summaryCard: { backgroundColor: "#fff", padding: "16px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginBottom: "20px" },
  summaryRow: { display: "flex", justifyContent: "space-between", margin: "4px 0" },
  inputArea: { backgroundColor: "#f0f2f5", padding: "12px", borderRadius: "12px", marginBottom: "20px" },
  input: { width: "100%", padding: "10px", marginBottom: "8px", fontSize: "16px", boxSizing: "border-box", border: "1px solid #ddd", borderRadius: "8px" },
  select: { padding: "10px", fontSize: "14px", marginBottom: "8px", borderRadius: "8px", border: "1px solid #ddd" },
  button: { width: "100%", padding: "12px", fontSize: "16px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold" },
  chartContainer: { backgroundColor: "#fff", padding: "12px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: "20px" },
  listItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #eee" },
  deleteBtn: { background: "none", border: "none", fontSize: "16px" },
  settingBtn: { background: "none", border: "none", fontSize: "20px" },
  budgetSettingBox: { padding: "12px", backgroundColor: "#eee", borderRadius: "8px", marginBottom: "12px" },
  saveBtn: { width: "100%", padding: "8px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px" }
};

const headerStyle = { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' };
const logoStyle = { width: '32px', height: '32px', borderRadius: '6px' };
const titleStyle = { fontSize: '20px', fontWeight: 'bold', margin: 0 };