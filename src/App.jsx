import { useState, useEffect } from "react";
import { 
  collection, addDoc, onSnapshot, query, orderBy, 
  doc, deleteDoc, serverTimestamp, setDoc, getDoc 
} from "firebase/firestore";
import { db } from "./firebase";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

// 📈 グラフの中にパーセンテージを表示するための計算式
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
  
  // 💰 予算管理用のステート
  const [monthlyBudget, setMonthlyBudget] = useState(90000); // 初期値
  const [isSettingOpen, setIsSettingOpen] = useState(false); // 設定画面の開閉
  const [tempBudget, setTempBudget] = useState(""); // 入力中の予算

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const remaining = monthlyBudget - total;

  useEffect(() => {
    // 1. 支出データの取得
    const q = query(collection(db, "kakeibo"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(data);
    });

    // 2. 予算データの取得（Firebaseから）
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

  // 予算を保存する関数
  const handleUpdateBudget = async () => {
    if (!tempBudget) return;
    try {
      await setDoc(doc(db, "settings", "budget"), {
        value: Number(tempBudget),
        updatedAt: serverTimestamp(),
      });
      setMonthlyBudget(Number(tempBudget));
      setIsSettingOpen(false);
      alert("予算を更新しました！");
    } catch (e) {
      console.error(e);
    }
  };

  // グラフデータ作成
  const chartData = items.reduce((acc, item) => {
    const found = acc.find((c) => c.name === item.category);
    if (found) { found.value += Number(item.amount); }
    else { acc.push({ name: item.category, value: Number(item.amount) }); }
    return acc;
  }, []);

  const COLORS = ["#FF8042", "#0088FE", "#00C49F", "#FFBB28", "#84d8ff", "#8884d8"];

  const handleAdd = async () => {
    if (!amount) return;
    try {
      await addDoc(collection(db, "kakeibo"), {
        amount: Number(amount),
        memo,
        category,
        date: date,
        createdAt: serverTimestamp(),
      });
      setAmount("");
      setMemo("");
    } catch (e) { console.error(e); }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("この明細を削除しますか？")) return;
    await deleteDoc(doc(db, "kakeibo", id));
  };

  const groupedItems = items.reduce((groups, item) => {
    const d = item.date || "日付なし";
    if (!groups[d]) groups[d] = [];
    groups[d].push(item);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedItems).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div style={styles.container}>
      <header style={headerStyle}>
        <img src="/icon.png" alt="logo" style={{...logoStyle, cursor: 'pointer'}} onClick={() => window.location.reload()} />
        <h1 style={{...titleStyle, cursor: 'pointer'}} onClick={() => window.location.reload()}>My Kakeibo</h1>
        <button onClick={() => setIsSettingOpen(!isSettingOpen)} style={styles.settingBtn}>⚙️</button>
      </header>

      {/* ⚙️ 予算設定エリア（隠し扉） */}
      {isSettingOpen && (
        <div style={styles.budgetSettingBox}>
          <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>今月の予算を設定</label>
          <input 
            type="number" 
            value={tempBudget} 
            onChange={(e) => setTempBudget(e.target.value)} 
            style={styles.input} 
            placeholder="例: 100000"
          />
          <button onClick={handleUpdateBudget} style={styles.saveBtn}>予算を更新する</button>
        </div>
      )}

      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
      <input type="number" placeholder="金額（円）" value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.input} />
      
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.select}>
        <option value="食品">食品</option>
        <option value="日用品">日用品</option>
        <option value="外食">外食</option>
        <option value="光熱費">光熱費</option>
        <option value="こたちゃん">こたちゃん</option>
        <option value="その他">その他</option>
      </select>
      <input placeholder="メモ" value={memo} onChange={(e) => setMemo(e.target.value)} style={styles.input} />
      <button onClick={handleAdd} style={styles.button}>追加</button>

      <div style={styles.summary}>
        <h2>合計：{total.toLocaleString()} 円</h2>
        <h2 style={{ color: remaining < 0 ? "red" : "black" }}>残り：{remaining.toLocaleString()} 円</h2>
      </div>

      {items.length > 0 && (
        <div style={styles.chartContainer}>
          <h3 style={{ textAlign: "center", marginBottom: "10px" }}>カテゴリー別割合</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={5} dataKey="value" labelLine={false} label={renderCustomizedLabel}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value.toLocaleString()}円`} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={styles.listContainer}>
        {sortedDates.map((dateString) => (
          <div key={dateString} style={{ marginBottom: "20px" }}>
            <div style={styles.dateHeader}>{dateString.replace(/-/g, "/")} ▼</div>
            {groupedItems[dateString].map((item) => (
              <div key={item.id} style={styles.listItem}>
                <span>{item.category} ／ <strong>{Number(item.amount).toLocaleString()}円</strong></span>
                <button onClick={() => deleteItem(item.id)} style={styles.deleteBtn}>🗑️</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { width: "100%", maxWidth: "480px", margin: "0 auto", padding: "16px", fontFamily: "sans-serif" },
  input: { width: "100%", padding: "12px", marginBottom: "8px", fontSize: "16px", boxSizing: "border-box", border: "1px solid #ccc", borderRadius: "4px" },
  select: { width: "100%", padding: "12px", fontSize: "16px", marginBottom: "8px", borderRadius: "4px", boxSizing: "border-box" },
  button: { width: "100%", padding: "12px", fontSize: "16px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" },
  summary: { marginTop: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "8px", borderLeft: "5px solid #007bff" },
  chartContainer: { marginTop: "30px", padding: "10px", backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" },
  listContainer: { marginTop: "20px" },
  dateHeader: { fontWeight: "bold", fontSize: "16px", margin: "15px 0 5px", color: "#666" },
  listItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #eee" },
  deleteBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "18px" },
  settingBtn: { background: "none", border: "none", fontSize: "24px", cursor: "pointer", marginLeft: "auto" },
  budgetSettingBox: { padding: "15px", backgroundColor: "#e9ecef", borderRadius: "8px", marginBottom: "20px" },
  saveBtn: { width: "100%", padding: "10px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }
};

const headerStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0' };
const logoStyle = { width: '40px', height: '40px', borderRadius: '8px' };
const titleStyle = { fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#333' };