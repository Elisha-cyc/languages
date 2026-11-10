import { useState } from "react";
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
  Japanese:["あ い う え お","か き く け こ","さ し す せ そ","た ち つ て と","な に ぬ ね の","は ひ ふ へ ほ","ま み む め も","や ゆ よ わ を ん","ら り る れ ろ","が ぎ ぐ げ ご","ざ じ ず ぜ ぞ","だ ぢ づ で ど","ば び ぶ べ ぼ","ぱ ぴ ぷ ぺ ぽ","ぁ ぃ ぅ ぇ ぉ っ ゃ ゅ ょ"],
  Korean:["ㅂ ㅈ ㄷ ㄱ ㅅ ㅛ ㅕ ㅑ ㅐ ㅔ","ㅁ ㄴ ㅇ ㄹ ㅎ ㅗ ㅓ ㅏ ㅣ","ㅋ ㅌ ㅊ ㅍ ㅠ ㅜ ㅡ"],
  Hindi:["ौ ै ा ी ू ब ह ग द ज","ो े ् ि ु प र क त च","ं म न व ल स य"],
  Arabic:["ض ص ث ق ف غ ع ه خ ح ج","ش س ي ب ل ا ت ن م ك","ظ ط ذ د ز ر ؤ ء ئ"],
  Greek:["; ς ε ρ τ υ θ ι ο π","α σ δ φ γ η ξ κ λ","ζ χ ψ ω β ν μ"],
  Hebrew:["ק ר א ט ו ן ם פ","ש ד ג כ ע י ח ל ך ף","ז ס ב ה נ מ צ ת"],
  Thai:["ๆ ไ ำ พ ะ ั ี ร น ย","ฟ ห ก ด เ ้ ่ า ส ว","ผ ป แ อ ิ ื ท ม ใ ฝ"],
};

// Offline starter lexicon. It is intentionally extendable; this is not a full IME dictionary.
const pinyinCandidates = {
  ni:["你","呢","尼"], hao:["好","号","浩"], nihao:["你好"], wo:["我"], shi:["是","时","事","市","十"],
  jie:["界","姐","接","借"], zai:["在","再"], jian:["见","间","件"], xue:["学","雪"], sheng:["生","声"],
  xuesheng:["学生"], zhong:["中","种","重"], guo:["国","过","果"], zhongguo:["中国"], ren:["人"],
  men:["们","门"], woaini:["我爱你"], ma:["吗","妈","马"], bu:["不","部"], hen:["很"], da:["大","打"],
  xiao:["小","笑"], ming:["明","名"], zi:["字","自","子"], mingzi:["名字"], qing:["请","情"], xie:["谢"],
  xiexie:["谢谢"], pengyou:["朋友"], laoshi:["老师"], xiansheng:["先生"], nimen:["你们"], women:["我们"],
  tamen:["他们","她们"], ta:["他","她","它"], de:["的","得","地"], le:["了","乐"], zai:["再","在"],
  jiao:["叫","教"], shenme:["什么"], shui:["谁","水"], na:["那","哪"], nar:["哪儿"], zheli:["这里"],
  nali:["那里"], jintian:["今天"], zuotian:["昨天"], mingtian:["明天"], xianzai:["现在"], shijian:["时间"],
  dianhua:["电话"], dianying:["电影"], diannao:["电脑"], pengyou:["朋友"], jia:["家","加"], xuexiao:["学校"],
  gongzuo:["工作"], xihuan:["喜欢"], ai:["爱","矮"], chi:["吃"], he:["喝","和"], kan:["看"], ting:["听"],
  shuo:["说"], du:["读","度"], xie:["写","谢"], mai:["买","卖"], qu:["去","取"], lai:["来"],
  hui:["会","回"], neng:["能"], yao:["要","药"], keyi:["可以"], buyao:["不要"], meiyou:["没有"],
  you:["有","又"], haohao:["好好"], henhao:["很好"], zaijian:["再见"], zaoan:["早安"], wanan:["晚安"],
  zao:["早"], wan:["晚","玩"], shang:["上","商"], xia:["下","夏"], zuo:["做","坐","左"], youbian:["右边"],
  zuobian:["左边"], qian:["前","钱"], hou:["后"], dong:["东","懂"], xi:["西","系"], nan:["南","男"],
  bei:["北","杯"], tianqi:["天气"], re:["热"], leng:["冷"], kaixin:["开心"], gaoxing:["高兴"],
  nanpengyou:["男朋友"], nvpengyou:["女朋友"], baba:["爸爸"], mama:["妈妈"], gege:["哥哥"], jiejie:["姐姐"],
  didi:["弟弟"], meimei:["妹妹"], haizi:["孩子"], xiaohai:["小孩"], yisheng:["医生"], xuesheng:["学生"],
  zhongwen:["中文"], hanyu:["汉语"], yingyu:["英语"], putonghua:["普通话"],
  zhongguoren:["中国人"], meiguo:["美国"], zhongguohao:["中国好"], shouji:["手机"], yinhang:["银行"],
  yidian:["一点"], duoshao:["多少"], ji:["几","机"], sui:["岁"], ge:["个","哥"],
  ben:["本"], zhang:["张"], liang:["两","辆"], san:["三"], si:["四"], wu:["五","物","无"], liu:["六"],
  qi:["七","起"], ba:["八","吧"], jiu:["九","就"], shi2:["十"], bai:["百"], qian2:["千"],
  yi:["一","衣"], er:["二","儿"], sanfen:["三分"], zaijian:["再见"], duibuqi:["对不起"], meiguanxi:["没关系"],
  qingwen:["请问"], buhao:["不好"], zaoshang:["早上"], xiawu:["下午"], wanshang:["晚上"],
  zhongwu:["中午"], xingqi:["星期"], xingqiyi:["星期一"], xingqitian:["星期天"], yue:["月"], nian:["年"],
  ri:["日"], hao3:["号"], shengri:["生日"], shenghuo:["生活"], fangjian:["房间"], shu:["书","数"],
  shuiguo:["水果"], pingguo:["苹果"], cha:["茶","查"], kafei:["咖啡"], fan:["饭","反"], miantiao:["面条"],
  cai:["菜","才"], rou:["肉"], niurou:["牛肉"], jidan:["鸡蛋"], mianbao:["面包"], shuijiao:["睡觉"],
  qichuang:["起床"], xizao:["洗澡"], xuexi:["学习"], yuyan:["语言"], hanyu:["汉语"], zhongwen:["中文"],
};

const japaneseCandidates = {
  "こんにちは":["今日は"], "こんばんは":["今晩は"], "ありがとう":["有難う","ありがとう"],
  "わたし":["私"], "ぼく":["僕"], "にほん":["日本"], "にほんご":["日本語"],
  "がくせい":["学生"], "せんせい":["先生"], "ともだち":["友達"], "がっこう":["学校"],
  "せかい":["世界"], "でんわ":["電話"], "でんしゃ":["電車"], "くるま":["車"],
  "ねこ":["猫"], "いぬ":["犬"], "みず":["水"], "ひと":["人"], "やま":["山"],
  "かわ":["川"], "きょう":["今日"], "あした":["明日"], "きのう":["昨日"],
  "いま":["今"], "じかん":["時間"], "たべる":["食べる"], "のみます":["飲みます"],
  "いきます":["行きます"], "きます":["来ます"], "みます":["見ます"], "ほん":["本"],
  "おかね":["お金"], "なまえ":["名前"], "おはよう":["お早う"], "さようなら":["さようなら"],
};
const H_INITIAL = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const H_MEDIAL = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const H_FINAL = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const VOWEL_COMBOS = {"ㅗㅏ":"ㅘ","ㅗㅐ":"ㅙ","ㅗㅣ":"ㅚ","ㅜㅓ":"ㅝ","ㅜㅔ":"ㅞ","ㅜㅣ":"ㅟ","ㅡㅣ":"ㅢ","ㅏㅣ":"ㅐ","ㅑㅣ":"ㅒ","ㅓㅣ":"ㅔ","ㅕㅣ":"ㅖ"};
const FINAL_COMBOS = {"ㄱㅅ":"ㄳ","ㄴㅈ":"ㄵ","ㄴㅎ":"ㄶ","ㄹㄱ":"ㄺ","ㄹㅁ":"ㄻ","ㄹㅂ":"ㄼ","ㄹㅅ":"ㄽ","ㄹㅌ":"ㄾ","ㄹㅍ":"ㄿ","ㄹㅎ":"ㅀ","ㅂㅅ":"ㅄ"};

function decomposeHangul(text) {
  return Array.from(text).flatMap((char) => {
    const code = char.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return [char];
    const initial = Math.floor(code / 588);
    const medial = Math.floor((code % 588) / 28);
    const final = code % 28;
    return [H_INITIAL[initial], H_MEDIAL[medial], ...(final ? [H_FINAL[final]] : [])];
  });
}
function composeHangul(text) {
  const chars = Array.from(text);
  let out = "";
  for (let i = 0; i < chars.length;) {
    const initial = H_INITIAL.indexOf(chars[i]);
    const medial = H_MEDIAL.indexOf(chars[i + 1]);
    if (initial < 0 || medial < 0) { out += chars[i]; i += 1; continue; }
    let vowel = chars[i + 1];
    let used = 2;
    const nextVowel = VOWEL_COMBOS[vowel + chars[i + 2]];
    if (nextVowel) { vowel = nextVowel; used = 3; }
    let final = "";
    const possibleFinal = chars[i + used];
    if (H_FINAL.includes(possibleFinal) && possibleFinal !== "" && H_INITIAL.includes(possibleFinal)) {
      const afterFinal = chars[i + used + 1];
      if (!H_MEDIAL.includes(afterFinal)) {
        final = possibleFinal;
        used += 1;
        const combo = FINAL_COMBOS[final + chars[i + used]];
        if (combo && !H_MEDIAL.includes(chars[i + used + 1])) { final = combo; used += 1; }
      }
    }
    const finalIndex = H_FINAL.indexOf(final);
    const vowelIndex = H_MEDIAL.indexOf(vowel);
    out += String.fromCharCode(0xac00 + initial * 588 + vowelIndex * 28 + finalIndex);
    i += used;
  }
  return out;
}
function appendKorean(value, key) {
  return composeHangul(decomposeHangul(value) .join("") + key);
}
function removeLastKorean(value) {
  const parts = decomposeHangul(value);
  parts.pop();
  return composeHangul(parts.join(""));
}
function toKatakana(char) {
  const code = char.charCodeAt(0);
  return code >= 0x3041 && code <= 0x3096 ? String.fromCharCode(code + 0x60) : char;
}
function toHiragana(char) {
  const code = char.charCodeAt(0);
  return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : char;
}

export function TargetLanguageKeyboard({ language, value, onChange }) {
  const [katakana, setKatakana] = useState(false);
  const rows = layouts[language] || layouts.Indonesian;
  const isPinyin = language === "Mandarin Chinese";
  const isJapanese = language === "Japanese";
  const isKorean = language === "Korean";
  const pendingPinyin = isPinyin ? value.split(/\s+/).pop().toLowerCase() : "";
  const pinyinOptions = isPinyin ? (pinyinCandidates[pendingPinyin] || []) : [];
  const japaneseTail = isJapanese ? (value.match(/[ぁ-ゖァ-ヺー]+$/)?.[0] || "") : "";
  const japaneseKey = Array.from(japaneseTail).map(toHiragana).join("");
  const japaneseOptions = isJapanese ? (japaneseCandidates[japaneseKey] || []) : [];
  const add = (key) => {
    if (isKorean) onChange(appendKorean(value, key));
    else if (isJapanese) onChange(value + (katakana ? toKatakana(key) : key));
    else onChange(value + key);
  };
  const choosePinyin = (word) => onChange(value.slice(0, value.length - pendingPinyin.length) + word + " ");
  const chooseJapanese = (word) => onChange(value.slice(0, value.length - japaneseTail.length) + word);
  const backspace = () => {
    if (isKorean) onChange(removeLastKorean(value));
    else onChange(Array.from(value).slice(0, -1).join(""));
  };
  return (
    <View style={styles.keyboard}>
      <Text style={styles.heading}>{language} in-app keyboard</Text>
      {isPinyin && <View style={styles.candidateRow}>
        {pinyinOptions.length ? pinyinOptions.map((word) => <Pressable key={word} style={styles.candidate} onPress={() => choosePinyin(word)}><Text style={styles.candidateText}>{word}</Text></Pressable>)
          : <Text style={styles.hint}>Enter a Pinyin syllable or word, then choose a matching candidate.</Text>}
      </View>}
      {isJapanese && <View style={styles.candidateRow}>
        <Pressable style={styles.modeButton} onPress={() => setKatakana((current) => !current)}><Text style={styles.modeText}>{katakana ? "カタカナ" : "ひらがな"} · Switch script</Text></Pressable>
        {japaneseOptions.map((word) => <Pressable key={word} style={styles.candidate} onPress={() => chooseJapanese(word)}><Text style={styles.candidateText}>{word}</Text></Pressable>)}
        {!japaneseOptions.length && <Text style={styles.hint}>Kana-to-kanji suggestions are available for common words; keep typing for kana input.</Text>}
      </View>}
      {isKorean && <Text style={styles.hint}>Consonants and vowels combine into Hangul syllables as you type.</Text>}
      {rows.map((row, i) => <View key={i} style={styles.row}>
        {row.split(" ").map((key) => <Pressable key={key} style={styles.key} onPress={() => add(key)}><Text style={styles.keyText}>{isJapanese && katakana ? toKatakana(key) : key}</Text></Pressable>)}
      </View>)}
      <View style={styles.row}>
        {(isPinyin || isJapanese || isKorean ? ["，", "。", "？", "！"] : [",", ".", "?", "!", "'", "-"]).map((key) => (
          <Pressable key={key} style={styles.key} onPress={() => add(key)}>
            <Text style={styles.keyText}>{key}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        <Pressable style={[styles.key,styles.utility]} onPress={() => add(" ")}><Text style={styles.utilityText}>Space</Text></Pressable>
        <Pressable style={[styles.key,styles.utility]} onPress={backspace}><Text style={styles.utilityText}>⌫</Text></Pressable>
        <Pressable style={[styles.key,styles.utility]} onPress={() => onChange("")}><Text style={styles.utilityText}>Clear</Text></Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  keyboard:{width:"100%",marginTop:12,padding:10,borderRadius:12,backgroundColor:"#edf1f8",gap:7},
  heading:{color:"#39465a",fontSize:13,fontWeight:"800",textAlign:"center"},
  row:{flexDirection:"row",justifyContent:"center",flexWrap:"wrap",gap:4},
  candidateRow:{flexDirection:"row",justifyContent:"center",alignItems:"center",flexWrap:"wrap",gap:5},
  key:{minWidth:27,minHeight:38,paddingHorizontal:6,paddingVertical:8,borderRadius:6,backgroundColor:"white",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#d8deea"},
  keyText:{color:"#172b4d",fontSize:16,fontWeight:"600"},
  utility:{flex:1,backgroundColor:"#dbe7ff"},utilityText:{color:"#245bb3",fontWeight:"700"},
  candidate:{paddingHorizontal:12,paddingVertical:5,borderRadius:7,backgroundColor:"white",borderWidth:1,borderColor:"#c9d8f4"},
  candidateText:{fontSize:18,color:"#172b4d"},hint:{color:"#68758a",fontSize:11,textAlign:"center",width:"100%"},
  modeButton:{paddingHorizontal:10,paddingVertical:6,borderRadius:7,backgroundColor:"#dbe7ff"},
  modeText:{color:"#245bb3",fontWeight:"700",fontSize:12},
});
