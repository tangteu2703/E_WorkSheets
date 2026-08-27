/**
 * LunarCalendar - Thư viện tính Âm Lịch Việt Nam chuẩn thiên văn (Hồ Ngọc Đức)
 * Múi giờ mặc định: GMT+7 (Việt Nam)
 */
const LunarCalendar = (() => {
    const PI = Math.PI;

    function INT(d) {
        return Math.floor(d);
    }

    function jdFromDate(dd, mm, yy) {
        let a = INT((14 - mm) / 12);
        let y = yy + 4800 - a;
        let m = mm + 12 * a - 3;
        let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
        if (jd < 2299161) {
            jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
        }
        return jd;
    }

    function jdToDate(jd) {
        let a, b, c, d, e, m, day, month, year;
        if (jd > 2299160) {
            a = jd + 32044;
            b = INT((4 * a + 3) / 146097);
            c = a - INT((146097 * b) / 4);
            d = INT((4 * c + 3) / 1461);
            e = c - INT((1461 * d) / 4);
            m = INT((5 * e + 2) / 153);
            day = e - INT((153 * m + 2) / 5) + 1;
            month = m + 3 - 12 * INT(m / 10);
            year = 100 * b + d - 4800 + INT(m / 10);
        } else {
            let b = 0;
            let c = jd + 32082;
            let d = INT((4 * c + 3) / 1461);
            let e = c - INT((1461 * d) / 4);
            let m = INT((5 * e + 2) / 153);
            day = e - INT((153 * m + 2) / 5) + 1;
            month = m + 3 - 12 * INT(m / 10);
            year = d - 4800 + INT(m / 10);
        }
        return [day, month, year];
    }

    function getNewMoonDay(k, timeZone = 7) {
        let T = k / 1236.85;
        let T2 = T * T;
        let T3 = T2 * T;
        let dr = PI / 180;
        let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
        Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
        let M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
        let Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
        let F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
        let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * M * dr);
        C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * Mpr * dr);
        C1 = C1 - 0.0004 * Math.sin(3 * Mpr * dr);
        C1 = C1 + 0.0104 * Math.sin(2 * F * dr) - 0.0051 * Math.sin((M + Mpr) * dr);
        C1 = C1 - 0.0074 * Math.sin((M - Mpr) * dr) + 0.0004 * Math.sin((2 * F + M) * dr);
        C1 = C1 - 0.0004 * Math.sin((2 * F - M) * dr) - 0.0006 * Math.sin((2 * F + Mpr) * dr);
        C1 = C1 + 0.0010 * Math.sin((2 * F - Mpr) * dr) + 0.0005 * Math.sin((M + 2 * Mpr) * dr);
        let deltat;
        if (T < -11) {
            deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
        } else {
            deltat = -0.000078 + 0.000267 * T + 0.000325 * T2 + 0.00000288 * T3;
        }
        let JdNew = Jd1 + C1 - deltat;
        return INT(JdNew + 0.5 + timeZone / 24);
    }

    function getSunLongitude(jdn, timeZone = 7) {
        let T = (jdn - 2451545.0 + 0.5 - timeZone / 24) / 36525;
        let T2 = T * T;
        let dr = PI / 180;
        let M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
        let L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
        let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(M * dr);
        DL = DL + (0.019993 - 0.000101 * T) * Math.sin(2 * M * dr) + 0.000290 * Math.sin(3 * M * dr);
        let L = L0 + DL;
        L = L * dr;
        L = L - PI * 2 * INT(L / (PI * 2));
        return INT(L / (PI / 6));
    }

    function getLunarMonth11(yy, timeZone = 7) {
        let off = jdFromDate(31, 12, yy) - 2415021;
        let k = INT(off / 29.530588853);
        let nm = getNewMoonDay(k, timeZone);
        let sunLong = getSunLongitude(nm, timeZone);
        if (sunLong >= 9) {
            nm = getNewMoonDay(k - 1, timeZone);
        }
        return nm;
    }

    function getLeapMonthOffset(a11, timeZone = 7) {
        let k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
        let last = 0;
        let i = 1;
        let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
        do {
            last = arc;
            i++;
            arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
        } while (arc != last && i < 14);
        return i - 1;
    }

    function convertSolar2Lunar(dd, mm, yy, timeZone = 7) {
        let dayNumber = jdFromDate(dd, mm, yy);
        let k = INT((dayNumber - 2415021.076998695) / 29.530588853);
        let monthStart = getNewMoonDay(k + 1, timeZone);
        if (monthStart > dayNumber) {
            monthStart = getNewMoonDay(k, timeZone);
        }
        let a11 = getLunarMonth11(yy, timeZone);
        let b11 = a11;
        let lunarYear;
        if (a11 >= monthStart) {
            lunarYear = yy;
            a11 = getLunarMonth11(yy - 1, timeZone);
        } else {
            lunarYear = yy + 1;
            b11 = getLunarMonth11(yy + 1, timeZone);
        }
        let lunarDay = dayNumber - monthStart + 1;
        let diff = INT((monthStart - a11) / 29);
        let lunarLeap = 0;
        let lunarMonth = diff + 11;
        if (b11 - a11 > 365) {
            let leapMonthDiff = getLeapMonthOffset(a11, timeZone);
            if (diff >= leapMonthDiff) {
                lunarMonth = diff + 10;
                if (diff == leapMonthDiff) {
                    lunarLeap = 1;
                }
            }
        }
        if (lunarMonth > 12) {
            lunarMonth = lunarMonth - 12;
        }
        if (lunarMonth >= 11 && diff < 4) {
            lunarYear = lunarYear - 1;
        }
        return [lunarDay, lunarMonth, lunarYear, lunarLeap];
    }

    function convertLunar2Solar(lunarDay, lunarMonth, lunarYear, lunarLeap = 0, timeZone = 7) {
        let a11;
        if (lunarMonth < 11) {
            a11 = getLunarMonth11(lunarYear - 1, timeZone);
        } else {
            a11 = getLunarMonth11(lunarYear, timeZone);
        }
        let k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
        let off = lunarMonth - 11;
        if (off < 0) {
            off = off + 12;
        }
        if (getLunarMonth11(lunarYear, timeZone) - a11 > 365) {
            let leapOff = getLeapMonthOffset(a11, timeZone);
            let leapMonth = leapOff - 2;
            if (leapMonth < 0) {
                leapMonth = leapMonth + 12;
            }
            if (lunarLeap != 0 && lunarMonth != leapMonth) {
                return [0, 0, 0];
            } else if (lunarLeap != 0 || off >= leapOff) {
                off = off + 1;
            }
        }
        let monthStart = getNewMoonDay(k + off, timeZone);
        return jdToDate(monthStart + lunarDay - 1);
    }

    function getDaysInLunarMonth(lunarMonth, lunarYear, lunarLeap = 0) {
        let [d30, m30, y30] = convertLunar2Solar(30, lunarMonth, lunarYear, lunarLeap);
        let [lDay30, lMonth30, lYear30, lLeap30] = convertSolar2Lunar(d30, m30, y30);
        if (lDay30 === 30 && lMonth30 === lunarMonth && lYear30 === lunarYear && lLeap30 === lunarLeap) {
            return 30;
        }
        return 29;
    }

    function getLunarMonthsInYear(lunarYear) {
        let a11 = getLunarMonth11(lunarYear - 1, 7);
        let b11 = getLunarMonth11(lunarYear, 7);
        let months = [];
        let leapMonth = 0;
        if (b11 - a11 > 365) {
            let leapOff = getLeapMonthOffset(a11, 7);
            leapMonth = leapOff - 2;
            if (leapMonth < 0) leapMonth += 12;
        }
        for (let m = 1; m <= 12; m++) {
            months.push({ month: m, isLeap: 0, label: `Tháng ${m}` });
            if (m === leapMonth) {
                months.push({ month: m, isLeap: 1, label: `Tháng ${m} Nhuận` });
            }
        }
        return months;
    }

    function getTodayLunar() {
        const now = new Date();
        return convertSolar2Lunar(now.getDate(), now.getMonth() + 1, now.getFullYear());
    }

    function getLunarMonthDaysDetail(lunarMonth, lunarYear, lunarLeap = 0) {
        const totalDays = getDaysInLunarMonth(lunarMonth, lunarYear, lunarLeap);
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const fullDayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const days = [];

        for (let d = 1; d <= totalDays; d++) {
            const [sDay, sMonth, sYear] = convertLunar2Solar(d, lunarMonth, lunarYear, lunarLeap);
            const solarDateObj = new Date(sYear, sMonth - 1, sDay);
            const dow = solarDateObj.getDay(); // 0 = CN, 1 = T2...
            days.push({
                lunarDay: d,
                lunarMonth,
                lunarYear,
                lunarLeap,
                solarDay: sDay,
                solarMonth: sMonth,
                solarYear: sYear,
                solarFormatted: `${sDay}/${sMonth}`,
                solarFullFormatted: `${String(sDay).padStart(2, '0')}/${String(sMonth).padStart(2, '0')}/${sYear}`,
                dayOfWeek: dow,
                dayOfWeekStr: dayNames[dow],
                fullDayOfWeekStr: fullDayNames[dow],
                isSunday: dow === 0
            });
        }
        return {
            lunarMonth,
            lunarYear,
            lunarLeap,
            totalDays,
            days
        };
    }

    return {
        convertSolar2Lunar,
        convertLunar2Solar,
        getDaysInLunarMonth,
        getLunarMonthsInYear,
        getTodayLunar,
        getLunarMonthDaysDetail
    };
})();

// Export globally
if (typeof window !== 'undefined') {
    window.LunarCalendar = LunarCalendar;
}
if (typeof module !== 'undefined') {
    module.exports = LunarCalendar;
}
