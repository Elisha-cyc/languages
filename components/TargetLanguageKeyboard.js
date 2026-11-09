import { View, Text, Pressable, StyleSheet } from "react-native";

const layouts = {
  French:["a z e r t y u i o p","q s d f g h j k l m","w x c v b n é è à ç ù"],
  Spanish:["q w e r t y u i o p","a s d f g h j k l ñ","z x c v b n á é í ó ú ü"],
  German:["q w e r t z u i o p ü","a s d f g h j k l ö ä","y x c v b n m ß"],
  Italian:["q w e r t y u i o p","a s d f g h j k l","z x c v b n m à è é ì ò ù"],
  Portuguese:["q w e r t y u i o p","a s d f g h j k l ç","z x c v b n m á â ã é ê í ó ô õ ú"],
  Dutch:["q w e r t y u i o p","a s d f g h j k l","z x c v b n m ë ï é"],
  Swedish:["q w e r t y u i o p å","a s d f g h j k l ö ä","z x c v b n m"],
  Polish:["q w e r t y u i o p","a s d f g h j k l ą ę","z x c v b n m ć ł ń ó ś ź ż"],
  Turkish:["q w e r t y u ı o p ğ ü","a s d f g h j k l ş i","z x c v b n m ö ç"],
  Indonesian:["q w e r t y u i o p","a s d f g h j k l","z x c v b n m"],
  Swahili:["q w e r t y u i o p","a s d f g h j k l","z x c v b n m"],
  Russian:["й ц у к е н г ш щ з х","ф ы в а п р о л д ж э","я ч с м и т ь б ю"],
  "Mandarin Chinese":["q w e r t y u i o p","a s d f g h j k l","z x c v b n m"],
  Japanese:["あ い う え お","か き く け こ","さ し す せ そ","た ち つ て と","な に ぬ ね の","は ひ ふ へ ほ","ま み む め も","や ゆ よ わ を ん"],
  Korean:["ㅂ ㅈ ㄷ ㄱ ㅅ ㅛ ㅕ ㅑ ㅐ ㅔ","ㅁ ㄴ ㅇ ㄹ ㅎ ㅗ ㅓ ㅏ ㅣ","ㅋ ㅌ ㅊ ㅍ ㅠ ㅜ ㅡ"],
  Hindi:["ौ ै ा ी ू ब ह ग द ज","ो े ् ि ु प र क त च","ं म न व ल स य"],
  Arabic:["ض ص ث ق ف غ ع ه خ ح ج","ش س ي ب ل ا ت ن م ك","ظ ط ذ د ز ر ؤ ء ئ"],
  Greek:["; ς ε ρ τ υ θ ι ο π","α σ δ φ γ η ξ κ λ","ζ χ ψ ω β ν μ"],
  Hebrew:["ק ר א ט ו ן ם פ","ש ד ג כ ע י ח ל ך ף","ז ס ב ה נ מ צ ת"],
  Thai:["ๆ ไ ำ พ ะ ั ี ร น ย","ฟ ห ก ด เ ้ ่ า ส ว","ผ ป แ อ ิ ื ท ม ใ ฝ"],
};
const candidates = {
  ni:["你","呢","尼"], hao:["好","号","浩"], nihao:["你好"], wo:["我"], shi:["是","时","事"],
  jie:["界","姐","接"], zai:["在","再"], jian:["见","间"], xue:["学","雪"], sheng:["生","声"],
  xuesheng:["学生"], zhong:["中","种"], guo:["国","过"], zhongguo:["中国"], ren:["人"],
  men:["们","门"], woaini:["我爱你"], ma:["吗","妈"], bu:["不"], hen:["很"], da:["大"],
  xiao:["小"], ming:["明","名"], zi:["字","自"], mingzi:["名字"], qing:["请"], xie:["谢"],
  xiexie:["谢谢"], pengyou:["朋友"],
};

export function TargetLanguageKeyboard({ language, value, onChange }) {
  const rows = layouts[language] || layouts.Indonesian;
  const isPinyin = language === "Mandarin Chinese";
  const pending = isPinyin ? value.split(/\s+/).pop().toLowerCase() : "";
  const options = isPinyin ? (candidates[pending] || []) : [];
  const add = (key) => onChange(value + key);
  const choose = (word) => onChange(value.slice(0, value.length - pending.length) + word + " ");
  return (
    <View style={styles.keyboard}>
      <Text style={styles.heading}>{language} in-app keyboard</Text>
      {isPinyin && <View style={styles.row}>
        {options.length ? options.map((word) => <Pressable key={word} style={styles.candidate} onPress={() => choose(word)}><Text style={styles.candidateText}>{word}</Text></Pressable>)
          : <Text style={styles.hint}>Type pinyin and select a suggested Chinese word when available.</Text>}
      </View>}
      {rows.map((row, i) => <View key={i} style={styles.row}>
        {row.split(" ").map((key) => <Pressable key={key} style={styles.key} onPress={() => add(key)}><Text style={styles.keyText}>{key}</Text></Pressable>)}
      </View>)}
      <View style={styles.row}>
        <Pressable style={[styles.key,styles.utility]} onPress={() => add(" ")}><Text style={styles.utilityText}>Space</Text></Pressable>
        <Pressable style={[styles.key,styles.utility]} onPress={() => onChange(value.slice(0,-1))}><Text style={styles.utilityText}>⌫</Text></Pressable>
        <Pressable style={[styles.key,styles.utility]} onPress={() => onChange("")}><Text style={styles.utilityText}>Clear</Text></Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  keyboard:{width:"100%",marginTop:12,padding:10,borderRadius:12,backgroundColor:"#edf1f8",gap:7},
  heading:{color:"#39465a",fontSize:13,fontWeight:"800",textAlign:"center"},
  row:{flexDirection:"row",justifyContent:"center",flexWrap:"wrap",gap:4},
  key:{minWidth:27,minHeight:38,paddingHorizontal:6,paddingVertical:8,borderRadius:6,backgroundColor:"white",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#d8deea"},
  keyText:{color:"#172b4d",fontSize:16,fontWeight:"600"},
  utility:{flex:1,backgroundColor:"#dbe7ff"},utilityText:{color:"#245bb3",fontWeight:"700"},
  candidate:{paddingHorizontal:12,paddingVertical:5,borderRadius:7,backgroundColor:"white",borderWidth:1,borderColor:"#c9d8f4"},
  candidateText:{fontSize:18,color:"#172b4d"},hint:{color:"#68758a",fontSize:11,textAlign:"center"},
});
