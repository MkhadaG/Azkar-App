export type AdhkarCategory = "morning" | "evening" | "after-prayer" | "sleeping" | "waking";

export interface Dhikr {
  id: string;
  category: AdhkarCategory[];
  arabic: string;
  meaning: { ar: string; en: string };
  reference: string;
  sourceUrl: string;
  repeat: number;
}

export const adhkar: Dhikr[] = [
  {
    id: "morning-ayatul-kursi",
    category: ["morning", "evening"],
    arabic: "ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَيُّ ٱلْقَيُّومُۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌۚ لَّهُۥ مَا فِي ٱلسَّمَٰوَٰتِ وَمَا فِي ٱلْأَرْضِۗ مَن ذَا ٱلَّذِي يَشْفَعُ عِندَهُۥٓ إِلَّا بِإِذْنِهِۦۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَآءَۚ وَسِعَ كُرْسِيُّهُ ٱلسَّمَٰوَٰتِ وَٱلْأَرْضَۖ وَلَا يَـُٔودُهُۥ حِفْظُهُمَاۚ وَهُوَ ٱلْعَلِيُّ ٱلْعَظِيمُ",
    meaning: {
      ar: "آية الكرسي من سورة البقرة.",
      en: "Ayat al-Kursi from Surah Al-Baqarah.",
    },
    reference: "Qur'an 2:255",
    sourceUrl: "https://quran.com/2/255",
    repeat: 1,
  },
  {
    id: "three-protective-surahs",
    category: ["morning", "evening"],
    arabic: "قُلْ هُوَ ٱللَّهُ أَحَدٌ ۝ ٱللَّهُ ٱلصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ ۝\n\nقُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ ۝ مِن شَرِّ مَا خَلَقَ ۝ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِن شَرِّ ٱلنَّفَّاثَاتِ فِي ٱلْعُقَدِ ۝ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ ۝\n\nقُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ ۝ مَلِكِ ٱلنَّاسِ ۝ إِلَٰهِ ٱلنَّاسِ ۝ مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ ۝ ٱلَّذِي يُوَسْوِسُ فِي صُدُورِ ٱلنَّاسِ ۝ مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ ۝",
    meaning: {
      ar: "سور الإخلاص والفلق والناس، تُقرأ ثلاث مرات في الصباح والمساء.",
      en: "Recite Surahs Al-Ikhlas, Al-Falaq, and An-Nas as one round, three times.",
    },
    reference: "Qur'an 112–114 · Sunan Abi Dawud 5082",
    sourceUrl: "https://sunnah.com/abudawud:5082",
    repeat: 3,
  },
  {
    id: "sleep-three-surahs",
    category: ["sleeping"],
    arabic: "قُلْ هُوَ ٱللَّهُ أَحَدٌ ۝ ٱللَّهُ ٱلصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ ۝\n\nقُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ ۝ مِن شَرِّ مَا خَلَقَ ۝ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِن شَرِّ ٱلنَّفَّاثَاتِ فِي ٱلْعُقَدِ ۝ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ ۝\n\nقُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ ۝ مَلِكِ ٱلنَّاسِ ۝ إِلَٰهِ ٱلنَّاسِ ۝ مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ ۝ ٱلَّذِي يُوَسْوِسُ فِي صُدُورِ ٱلنَّاسِ ۝ مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ ۝",
    meaning: {
      ar: "سور الإخلاص والفلق والناس، تُقرأ ثلاث مرات قبل النوم.",
      en: "Recite Surahs Al-Ikhlas, Al-Falaq, and An-Nas, then repeat the round three times.",
    },
    reference: "Sahih al-Bukhari 5017",
    sourceUrl: "https://sunnah.com/bukhari:5017",
    repeat: 3,
  },
  {
    id: "morning-evening-dominion",
    category: ["morning"],
    arabic: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.",
    meaning: {
      ar: "إقرار بأن الملك لله وسؤاله خير اليوم والاستعاذة من شره.",
      en: "Praise Allah for the new day and ask for its good and protection from its harms.",
    },
    reference: "Sahih Muslim 2723",
    sourceUrl: "https://sunnah.com/muslim:2723",
    repeat: 1,
  },
  {
    id: "evening-dominion",
    category: ["evening"],
    arabic: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.",
    meaning: {
      ar: "إقرار بأن الملك لله وسؤاله خير الليلة والاستعاذة من شرها.",
      en: "Praise Allah for the evening and ask for its good and protection from its harms.",
    },
    reference: "Sahih Muslim 2723",
    sourceUrl: "https://sunnah.com/muslim:2723",
    repeat: 1,
  },
  {
    id: "morning-bika-asbahna",
    category: ["morning"],
    arabic: "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ.",
    meaning: {
      ar: "تفويض بداية اليوم ونهايته والحياة والموت إلى الله.",
      en: "Entrust the morning, evening, life, and death to Allah.",
    },
    reference: "Sunan Abi Dawud 5068",
    sourceUrl: "https://sunnah.com/abudawud:5068",
    repeat: 1,
  },
  {
    id: "evening-bika-amsayna",
    category: ["evening"],
    arabic: "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ.",
    meaning: {
      ar: "تفويض بداية الليل ونهايته والحياة والموت إلى الله.",
      en: "Entrust the evening, life, and death to Allah.",
    },
    reference: "Sunan Abi Dawud 5068",
    sourceUrl: "https://sunnah.com/abudawud:5068",
    repeat: 1,
  },
  {
    id: "sayyid-al-istighfar",
    category: ["morning", "evening"],
    arabic: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَىٰ عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي، فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.",
    meaning: {
      ar: "اعتراف بربوبية الله ونعمه وطلب المغفرة.",
      en: "Acknowledge Allah as Lord, recognize His blessings, and ask His forgiveness.",
    },
    reference: "Sahih al-Bukhari 6306",
    sourceUrl: "https://sunnah.com/bukhari:6306",
    repeat: 1,
  },
  {
    id: "daily-wellbeing",
    category: ["morning", "evening"],
    arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ وَمِنْ خَلْفِي وَعَنْ يَمِينِي وَعَنْ شِمَالِي وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي.",
    meaning: {
      ar: "سؤال العفو والعافية والحفظ في الدين والدنيا والأهل والمال.",
      en: "Ask Allah for pardon, well-being, and protection for faith, family, and livelihood.",
    },
    reference: "Sunan Abi Dawud 5074",
    sourceUrl: "https://sunnah.com/abudawud:5074",
    repeat: 1,
  },
  {
    id: "morning-evening-favors",
    category: ["morning"],
    arabic: "اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ، فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ.",
    meaning: {
      ar: "نسبة النعم إلى الله وحمده وشكره عليها.",
      en: "Recognize every blessing as from Allah and give Him praise and thanks.",
    },
    reference: "Sunan Abi Dawud 5073",
    sourceUrl: "https://sunnah.com/abudawud:5073",
    repeat: 1,
  },
  {
    id: "evening-favors",
    category: ["evening"],
    arabic: "اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ، فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ.",
    meaning: {
      ar: "نسبة النعم إلى الله وحمده وشكره عليها.",
      en: "Recognize every blessing as from Allah and give Him praise and thanks.",
    },
    reference: "Sunan Abi Dawud 5073",
    sourceUrl: "https://sunnah.com/abudawud:5073",
    repeat: 1,
  },
  {
    id: "protection-with-allahs-name",
    category: ["morning", "evening"],
    arabic: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ.",
    meaning: {
      ar: "الاستعاذة باسم الله الذي لا يضر مع ذكره شيء.",
      en: "Seek protection through Allah's name; nothing can cause harm alongside His name.",
    },
    reference: "Sunan Abi Dawud 5088",
    sourceUrl: "https://sunnah.com/abudawud:5088",
    repeat: 3,
  },
  {
    id: "contentment-with-allah",
    category: ["morning", "evening"],
    arabic: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا.",
    meaning: {
      ar: "الإقرار بالرضا بالله ربًّا وبالإسلام دينًا وبمحمد نبيًّا.",
      en: "Affirm contentment with Allah as Lord, Islam as faith, and Muhammad as Prophet.",
    },
    reference: "Jami` at-Tirmidhi 3389",
    sourceUrl: "https://sunnah.com/tirmidhi:3389",
    repeat: 3,
  },
  {
    id: "wellbeing-in-body",
    category: ["morning", "evening"],
    arabic: "اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَٰهَ إِلَّا أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لَا إِلَٰهَ إِلَّا أَنْتَ.",
    meaning: {
      ar: "سؤال العافية في البدن والسمع والبصر والاستعاذة من الشر.",
      en: "Ask for well-being in body, hearing, and sight, and seek refuge from harm.",
    },
    reference: "Sunan Abi Dawud 5090",
    sourceUrl: "https://sunnah.com/abudawud:5090",
    repeat: 3,
  },
  {
    id: "creator-of-heavens",
    category: ["morning", "evening", "sleeping"],
    arabic: "اللَّهُمَّ فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، عَالِمَ الْغَيْبِ وَالشَّهَادَةِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَىٰ نَفْسِي سُوءًا، أَوْ أَجُرَّهُ إِلَىٰ مُسْلِمٍ.",
    meaning: {
      ar: "دعاء بالتوحيد والاستعاذة من شر النفس والشيطان.",
      en: "Affirm Allah's oneness and seek refuge from the self and Satan's harm.",
    },
    reference: "Sunan Abi Dawud 5067",
    sourceUrl: "https://sunnah.com/abudawud:5067",
    repeat: 1,
  },
  {
    id: "morning-evening-tasbih",
    category: ["morning"],
    arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ.",
    meaning: {
      ar: "تنزيه الله وحمده بذكر عظيم.",
      en: "Glorify and praise Allah with words of abundant remembrance.",
    },
    reference: "Sahih Muslim 2726",
    sourceUrl: "https://sunnah.com/muslim:2726",
    repeat: 3,
  },
  {
    id: "after-prayer-istighfar",
    category: ["after-prayer"],
    arabic: "أَسْتَغْفِرُ اللَّهَ.",
    meaning: {
      ar: "طلب المغفرة من الله.",
      en: "Ask Allah for forgiveness.",
    },
    reference: "Sahih Muslim 591",
    sourceUrl: "https://sunnah.com/muslim:591",
    repeat: 3,
  },
  {
    id: "after-prayer-salam",
    category: ["after-prayer"],
    arabic: "اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ.",
    meaning: {
      ar: "سؤال السلام من الله والثناء عليه.",
      en: "Ask Allah, the source of peace, for peace and praise Him.",
    },
    reference: "Sahih Muslim 591",
    sourceUrl: "https://sunnah.com/muslim:591",
    repeat: 1,
  },
  {
    id: "after-prayer-tahlil",
    category: ["after-prayer"],
    arabic: "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، اللَّهُمَّ لَا مَانِعَ لِمَا أَعْطَيْتَ، وَلَا مُعْطِيَ لِمَا مَنَعْتَ، وَلَا يَنْفَعُ ذَا الْجَدِّ مِنْكَ الْجَدُّ.",
    meaning: {
      ar: "توحيد الله والإقرار بملكه وفضله.",
      en: "Affirm Allah's oneness, dominion, and that all provision is from Him.",
    },
    reference: "Sahih al-Bukhari 844",
    sourceUrl: "https://sunnah.com/bukhari:844",
    repeat: 1,
  },
  {
    id: "after-prayer-subhanallah",
    category: ["after-prayer"],
    arabic: "سُبْحَانَ اللَّهِ.",
    meaning: {
      ar: "تنزيه الله عن كل نقص.",
      en: "Glory be to Allah.",
    },
    reference: "Sahih Muslim 597",
    sourceUrl: "https://sunnah.com/muslim:597",
    repeat: 33,
  },
  {
    id: "after-prayer-alhamdulillah",
    category: ["after-prayer"],
    arabic: "الْحَمْدُ لِلَّهِ.",
    meaning: {
      ar: "الثناء على الله وحمده.",
      en: "All praise belongs to Allah.",
    },
    reference: "Sahih Muslim 597",
    sourceUrl: "https://sunnah.com/muslim:597",
    repeat: 33,
  },
  {
    id: "after-prayer-allahu-akbar",
    category: ["after-prayer"],
    arabic: "اللَّهُ أَكْبَرُ.",
    meaning: {
      ar: "الله أعظم من كل شيء.",
      en: "Allah is the Greatest.",
    },
    reference: "Sahih Muslim 597",
    sourceUrl: "https://sunnah.com/muslim:597",
    repeat: 33,
  },
  {
    id: "after-prayer-final-tahlil",
    category: ["after-prayer"],
    arabic: "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ.",
    meaning: {
      ar: "تُختم التسبيحات بالإقرار بوحدانية الله وقدرته.",
      en: "Complete the post-prayer praises by affirming Allah's oneness and power.",
    },
    reference: "Sahih Muslim 597",
    sourceUrl: "https://sunnah.com/muslim:597",
    repeat: 1,
  },
  {
    id: "after-prayer-help",
    category: ["after-prayer"],
    arabic: "اللَّهُمَّ أَعِنِّي عَلَىٰ ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ.",
    meaning: {
      ar: "طلب العون على ذكر الله وشكره وحسن عبادته.",
      en: "Ask Allah to help you remember, thank, and worship Him well.",
    },
    reference: "Sunan Abi Dawud 1522",
    sourceUrl: "https://sunnah.com/abudawud:1522",
    repeat: 1,
  },
  {
    id: "sleep-ayatul-kursi",
    category: ["sleeping"],
    arabic: "ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَيُّ ٱلْقَيُّومُۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌۚ لَّهُۥ مَا فِي ٱلسَّمَٰوَٰتِ وَمَا فِي ٱلْأَرْضِۗ مَن ذَا ٱلَّذِي يَشْفَعُ عِندَهُۥٓ إِلَّا بِإِذْنِهِۦۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَآءَۚ وَسِعَ كُرْسِيُّهُ ٱلسَّمَٰوَٰتِ وَٱلْأَرْضَۖ وَلَا يَـُٔودُهُۥ حِفْظُهُمَاۚ وَهُوَ ٱلْعَلِيُّ ٱلْعَظِيمُ",
    meaning: {
      ar: "آية الكرسي من سورة البقرة.",
      en: "Ayat al-Kursi from Surah Al-Baqarah.",
    },
    reference: "Qur'an 2:255 · Sahih al-Bukhari 2311",
    sourceUrl: "https://sunnah.com/bukhari:2311",
    repeat: 1,
  },
  {
    id: "sleep-last-two-baqarah",
    category: ["sleeping"],
    arabic: "ءَامَنَ ٱلرَّسُولُ بِمَآ أُنزِلَ إِلَيْهِ مِن رَّبِّهِۦ وَٱلْمُؤْمِنُونَۚ كُلٌّ ءَامَنَ بِٱللَّهِ وَمَلَٰٓئِكَتِهِۦ وَكُتُبِهِۦ وَرُسُلِهِۦ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّن رُّسُلِهِۦۚ وَقَالُوا سَمِعْنَا وَأَطَعْنَا غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ ٱلْمَصِيرُ ۝ لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا ٱكْتَسَبَتْ رَبَّنَا لَا تُؤَاخِذْنَآ إِن نَّسِينَآ أَوْ أَخْطَأْنَا رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَآ إِصْرًا كَمَا حَمَلْتَهُۥ عَلَى ٱلَّذِينَ مِن قَبْلِنَا رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِۦ وَٱعْفُ عَنَّا وَٱغْفِرْ لَنَا وَٱرْحَمْنَآ أَنتَ مَوْلَىٰنَا فَٱنصُرْنَا عَلَى ٱلْقَوْمِ ٱلْكَٰفِرِينَ",
    meaning: {
      ar: "الآيتان الأخيرتان من سورة البقرة.",
      en: "The final two verses of Surah Al-Baqarah.",
    },
    reference: "Qur'an 2:285–286 · Sahih al-Bukhari 5009",
    sourceUrl: "https://sunnah.com/bukhari:5009",
    repeat: 1,
  },
  {
    id: "sleep-submit-to-allah",
    category: ["sleeping"],
    arabic: "اللَّهُمَّ أَسْلَمْتُ وَجْهِيَ إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لَا مَلْجَأَ وَلَا مَنْجَا مِنْكَ إِلَّا إِلَيْكَ، آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ.",
    meaning: {
      ar: "تفويض النفس والأمر إلى الله قبل النوم.",
      en: "Entrust yourself and your affairs to Allah before sleep.",
    },
    reference: "Sahih al-Bukhari 247 · Sahih Muslim 2710",
    sourceUrl: "https://sunnah.com/muslim:2710",
    repeat: 1,
  },
  {
    id: "sleep-bismika-amutu",
    category: ["sleeping"],
    arabic: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا.",
    meaning: {
      ar: "ذكر الله عند النوم.",
      en: "Remember Allah when going to sleep.",
    },
    reference: "Sahih al-Bukhari 6324",
    sourceUrl: "https://sunnah.com/bukhari:6324",
    repeat: 1,
  },
  {
    id: "sleep-subhanallah",
    category: ["sleeping"],
    arabic: "سُبْحَانَ اللَّهِ.",
    meaning: {
      ar: "تنزيه الله عن كل نقص.",
      en: "Glory be to Allah.",
    },
    reference: "Sahih al-Bukhari 5361",
    sourceUrl: "https://sunnah.com/bukhari:5361",
    repeat: 33,
  },
  {
    id: "sleep-alhamdulillah",
    category: ["sleeping"],
    arabic: "الْحَمْدُ لِلَّهِ.",
    meaning: {
      ar: "الثناء على الله وحمده.",
      en: "All praise belongs to Allah.",
    },
    reference: "Sahih al-Bukhari 5361",
    sourceUrl: "https://sunnah.com/bukhari:5361",
    repeat: 33,
  },
  {
    id: "sleep-allahu-akbar",
    category: ["sleeping"],
    arabic: "اللَّهُ أَكْبَرُ.",
    meaning: {
      ar: "الله أعظم من كل شيء.",
      en: "Allah is the Greatest.",
    },
    reference: "Sahih al-Bukhari 5361",
    sourceUrl: "https://sunnah.com/bukhari:5361",
    repeat: 34,
  },
  {
    id: "sleep-placing-side",
    category: ["sleeping"],
    arabic: "بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ.",
    meaning: {
      ar: "استيداع النفس لله وطلب الرحمة والحفظ.",
      en: "Place yourself in Allah's care and ask for mercy and protection.",
    },
    reference: "Sahih al-Bukhari 6320",
    sourceUrl: "https://sunnah.com/bukhari:6320",
    repeat: 1,
  },
  {
    id: "waking-praise",
    category: ["waking"],
    arabic: "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ.",
    meaning: {
      ar: "حمد الله على الإحياء بعد النوم والبعث إليه.",
      en: "Praise Allah for restoring life after sleep; to Him is the resurrection.",
    },
    reference: "Sahih al-Bukhari 6312",
    sourceUrl: "https://sunnah.com/bukhari:6312",
    repeat: 1,
  },
  {
    id: "waking-night-remembrance",
    category: ["waking"],
    arabic: "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، الْحَمْدُ لِلَّهِ، وَسُبْحَانَ اللَّهِ، وَلَا إِلَٰهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ.",
    meaning: {
      ar: "ذكر التوحيد والحمد والتسبيح عند الاستيقاظ ليلًا.",
      en: "A remembrance of Allah when waking during the night.",
    },
    reference: "Sahih al-Bukhari 1154",
    sourceUrl: "https://sunnah.com/bukhari:1154",
    repeat: 1,
  },
];

export function getActiveDhikr(items: Dhikr[], counts: Record<string, number>): Dhikr | null {
  return items.find((item) => (counts[item.id] ?? 0) < item.repeat) ?? null;
}

export function getCompletedDhikrCount(items: Dhikr[], counts: Record<string, number>): number {
  return items.filter((item) => (counts[item.id] ?? 0) >= item.repeat).length;
}

export function getDhikrProgressKey(category: AdhkarCategory, id: string): string {
  return `${category}:${id}`;
}
