// The praytime package ships without TypeScript types. This declares the parts Azkar uses.
declare module "praytime" {
  export class PrayTime {
    constructor(method?: string);
    methods: Record<string, Record<string, number | string>>;
    method(name: string): this;
    location(coordinates: [number, number]): this;
    timezone(timeZone: string): this;
    getTimes(date: Date | [number, number, number]): Record<
      "fajr" | "sunrise" | "dhuhr" | "asr" | "sunset" | "maghrib" | "isha" | "midnight",
      string
    >;
  }
}
