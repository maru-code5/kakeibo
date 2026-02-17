import { useState, useEffect } from "react";
import { 
  collection, addDoc, onSnapshot, query, orderBy, 
  doc, deleteDoc, serverTimestamp 
} from "firebase/firestore";
import { db } from "./firebase";
// 📊 グラフ用の部品をインポート
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export default function App() {
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState("食品");
  const [items, setItems] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const monthlyBudget = 90000;
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const remaining = monthlyBudget - total;

  useEffect(() => {
    const q = query(collection(db, "kakeibo"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(data);
    });
    return () => unsubscribe();
  }, []);

  // 📈 カテゴリごとに集計するデータ作成
  const chartData = items.reduce((acc, item) => {
    const found = acc.find((c) => c.name === item.category);
    if (found) {
      found.value += Number(item.amount);
    } else {
      acc.push({ name: item.category, value: Number(item.amount) });
    }
    return acc;
  }, []);

  // 🎨 グラフの色設定
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
    } catch (e) {
      console.error(e);
    }
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
        <img src="/icon.png" alt="logo" style={logoStyle} />
        <h1 style={titleStyle}>My Kakeibo</h1>
      </header>

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

      <input placeholder="お店の名前など" value={memo} onChange={(e) => setMemo(e.target.value)} style={styles.input} />

      <button onClick={handleAdd} style={styles.button}>追加</button>

      <div style={styles.summary}>
        <h2>合計：{total.toLocaleString()} 円</h2>
        <h2 style={{ color: remaining < 0 ?