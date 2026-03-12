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

  useEffect(() => {
    const q = query(collection(db, "kakeibo"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setItems(data);
    });
    const fetchBudget = async () => {
      try {
        const budgetDoc = await getDoc(doc(db, "settings", "budget"));
        if (budgetDoc.exists()) {
          setMonthlyBudget(budgetDoc.data().value);
          setTempBudget(budgetDoc.data().value);
        }
      } catch (e) { console.error(e); }
    };
    fetchBudget();
    return () => unsubscribe();
  }, []);

  // 📅 安全に期間を計算する関数
  const getPeriod = (targetDate) => {
    try {
      const d = new Date(targetDate);
      if (isNaN(d.getTime())) return { start: new Date(), end: new Date() }; // 不正な日付対策
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      let start, end;
      if (day <= 15) {
        start = new Date(year, month - 1, 16);
        end = new Date(year, month, 15);
      } else {
        start = new Date(year, month, 16);
        end = new Date(year, month + 1, 15);
      }
      return { start, end };
    } catch (e) {
      return { start: new Date(), end: new Date() };
    }
  };

  const todayPeriod = getPeriod(new Date());
  const lastMonthRef = new Date(todayPeriod.start);
  lastMonthRef.setDate(lastMonthRef.getDate() - 1);
  const lastPeriod = getPeriod(lastMonthRef);

  // 💰 集計関数（エラー対策済み）
  const getSum = (period) => {
    if (!items || items.length === 0) return 0;
    return items
      .filter(item => {
        if (!item.date) return false;
        const itemDate = new Date(item.date);
        return itemDate >= period.start && itemDate <= period.end;
      })
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  };

  const currentTotal = getSum(todayPeriod);
  const lastTotal = getSum(lastPeriod);
  const carryOver = monthlyBudget - lastTotal;
  const remaining = (monthlyBudget + carryOver) - currentTotal;

  // グラフ用データ
  const chartData = items
    .filter(item => {
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      return itemDate >= todayPeriod.start && itemDate <= todayPeriod.end;
    })
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
    if (!window.confirm("削除しますか？")) return;
    await deleteDoc(doc(db, "kakeibo", id));
  };

  return (
    <div style={styles.container}>
      <header style={headerStyle}>
        <img src="/icon.png" alt="logo" style={{...logoStyle, cursor: 'pointer'}} onClick={() => window.location.reload()} />
        <h1 style={{...titleStyle, fontSize: '18px', cursor: 'pointer'}} onClick={() => window.location.reload()}>My Kakeibo</h1>
        <button onClick={() => setIsSettingOpen(!isSettingOpen)} style={styles.settingBtn}>⚙️</button>
      </header>

      {isSettingOpen && (
        <div style={styles.budgetSettingBox}>
          <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>1サイクルの予算</label>
          <input type="number" value={tempBudget} onChange={(e) => setTempBudget(e.target.value)} style={styles.input} />
          <button onClick={handleUpdateBudget} style={styles.saveBtn}>設定保存</button>
        </div>
      )}

      <div style={styles.summaryCard}>
        <div style={{fontSize: '11px', color: '#888', marginBottom: '8px'}}>
          期間: {todayPeriod.start.toLocaleDateString()}〜{todayPeriod.end.toLocaleDateString()}
        </div>
        <div style={styles.summaryRow}><span>基本予算:</span> <span>{monthlyBudget.toLocaleString()}円</span></div>
        <div style={{...styles.summaryRow, color: carryOver >= 0 ? "blue" : "red"}}>
          <span>前回の繰越:</span> <span>{carryOver >= 0 ? "+" : ""}{carryOver.toLocaleString()}円</span>
        </div>
        <hr style={{border: 'none', borderTop: '1px dashed #eee', margin: '10px 0'}} />
        <div style={styles.summaryRow}><strong>今回の支出:</strong> <strong>{currentTotal.toLocaleString()}円</strong></div>
        <div style={{...styles.summaryRow, fontSize: "1.2em", color: remaining < 0 ? "red" : "green"}}>
          <strong>残り（繰越込）:</strong> <strong>{remaining.toLocaleString()}円</strong>
        </div>
      </div>

      <div style={styles.inputArea}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
        <div style={{display: "flex", gap: "8px"}}>
          <input type="number" placeholder="金額" value={amount} onChange={(e) => setAmount(e.target.value)} style={{...styles.input, flex: 2}} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{...styles.select, flex: 1.5}}>
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
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" label={renderCustomizedLabel}>
                {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v.toLocaleString()}円`} />
              <Legend iconSize={10} wrapperStyle={{fontSize: "10px"}} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={styles.listContainer}>
        <h3 style={{fontSize: "13px", color: "#666", marginBottom: "10px"}}>履歴（直近10件）</h3>
        {items.slice(0, 10).map((item) => (
          <div key={item.id} style={styles.listItem}>
            <span style={{fontSize: "11px", color: "#888", flex: "0 0 80px"}}>{item.date?.replace(/-/g, "/").slice(5)}</span>
            <span style={{flex: 1}}>{item.category} / <strong>{item.amount?.toLocaleString()}円</strong></span>
            <button onClick={() => deleteItem(item.id)} style={styles.deleteBtn}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { width: "100%", maxWidth: "480px", margin: "0 auto", padding: "12px", fontFamily: "sans-serif", color: "#333" },
  summaryCard: { backgroundColor: "#fff", padding: "16px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginBottom: "16px" },
  summaryRow: { display: "flex", justifyContent: "space-between", margin: "4px 0" },
  inputArea: { backgroundColor: "#f0f2f5", padding: "12px", borderRadius: "12px", marginBottom: "16px" },
  input: { width: "100%", padding: "10px", marginBottom: "8px", fontSize: "16px", boxSizing: "border-box", border: "1px solid #ddd", borderRadius: "8px" },
  select: { padding: "10px", fontSize: "14px", marginBottom: "8px", borderRadius: "8px", border: "1px solid #ddd", backgroundColor: "#fff" },
  button: { width: "100%", padding: "12px", fontSize: "16px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold" },
  chartContainer: { backgroundColor: "#fff", padding: "12px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: "16px" },
  listContainer: { marginTop: "16px" },
  listItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #eee" },
  deleteBtn: { background: "none", border: "none", fontSize: "16px", color: "#ccc" },
  settingBtn: { background: "none", border: "none", fontSize: "20px", cursor: "pointer", marginLeft: "auto" },
  budgetSettingBox: { padding: "12px", backgroundColor: "#eee", borderRadius: "8px", marginBottom: "12px" },
  saveBtn: { width: "100%", padding: "8px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px" }
};
const headerStyle = { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' };
const logoStyle = { width: '32px', height: '32px', borderRadius: '6px' };
const titleStyle = { fontWeight: 'bold', margin: 0 };