export interface HomeHadith {
  ar: string;
  en: string;
  sourceAr: string;
  sourceEn: string;
}

export const homeHadiths: readonly HomeHadith[] = [
  {
    ar: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى.",
    en: "Actions are judged by intentions, and each person will have what they intended.",
    sourceAr: "صحيح البخاري 1",
    sourceEn: "Sahih al-Bukhari 1",
  },
  {
    ar: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ.",
    en: "None of you truly believes until he loves for his brother what he loves for himself.",
    sourceAr: "صحيح البخاري 13",
    sourceEn: "Sahih al-Bukhari 13",
  },
  {
    ar: "الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ.",
    en: "A Muslim is the one who avoids harming Muslims with his tongue and hands.",
    sourceAr: "صحيح البخاري 10",
    sourceEn: "Sahih al-Bukhari 10",
  },
  {
    ar: "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ.",
    en: "Whoever believes in Allah and the Last Day should speak good or remain silent.",
    sourceAr: "صحيح البخاري 6018",
    sourceEn: "Sahih al-Bukhari 6018",
  },
  {
    ar: "إِنَّ اللَّهَ لَا يَنْظُرُ إِلَى أَجْسَادِكُمْ وَلَا إِلَى صُوَرِكُمْ، وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ.",
    en: "Allah does not look at your bodies or faces, but He looks at your hearts.",
    sourceAr: "صحيح مسلم 2564",
    sourceEn: "Sahih Muslim 2564b",
  },
  {
    ar: "الطُّهُورُ شَطْرُ الْإِيمَانِ.",
    en: "Cleanliness is half of faith.",
    sourceAr: "صحيح مسلم 223",
    sourceEn: "Sahih Muslim 223",
  },
  {
    ar: "وَأَنَّ أَحَبَّ الأَعْمَالِ أَدْوَمُهَا إِلَى اللَّهِ، وَإِنْ قَلَّ.",
    en: "The most beloved deeds to Allah are those done regularly, even if they are few.",
    sourceAr: "صحيح البخاري 6464",
    sourceEn: "Sahih al-Bukhari 6464",
  },
];

const LAST_HOME_HADITH_KEY = "azkar.last-home-hadith-index";

/** Choose once per app launch, avoiding the hadith shown on the previous launch. */
export function getHomeHadithForLaunch(): HomeHadith {
  let previousIndex = -1;

  try {
    const savedIndex = window.localStorage.getItem(LAST_HOME_HADITH_KEY);
    if (savedIndex !== null) {
      const parsedIndex = Number(savedIndex);
      if (Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < homeHadiths.length) {
        previousIndex = parsedIndex;
      }
    }
  } catch {
    // Continue with a random choice if local storage is unavailable.
  }

  const availableIndexes = homeHadiths
    .map((_, index) => index)
    .filter((index) => index !== previousIndex);
  const selectedIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)] ?? 0;

  try {
    window.localStorage.setItem(LAST_HOME_HADITH_KEY, String(selectedIndex));
  } catch {
    // The selection still works for this launch if local storage is unavailable.
  }

  return homeHadiths[selectedIndex];
}
