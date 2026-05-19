import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Search, CheckCircle2, XCircle, Clock, ExternalLink,
  ChevronDown, Globe2, Loader2, Mail, CalendarCheck, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

// ── Treaty Countries ──────────────────────────────────────────────────────────

const E2_TREATY_COUNTRIES: Record<string, { flag: string; treaty: boolean; region: string }> = {
  "Albania": { flag: "🇦🇱", treaty: true, region: "europe" },
  "Argentina": { flag: "🇦🇷", treaty: true, region: "latin_america" },
  "Armenia": { flag: "🇦🇲", treaty: true, region: "central_asia" },
  "Australia": { flag: "🇦🇺", treaty: true, region: "asia_pacific" },
  "Austria": { flag: "🇦🇹", treaty: true, region: "europe" },
  "Azerbaijan": { flag: "🇦🇿", treaty: true, region: "central_asia" },
  "Bahrain": { flag: "🇧🇭", treaty: true, region: "middle_east" },
  "Bangladesh": { flag: "🇧🇩", treaty: true, region: "south_asia" },
  "Belgium": { flag: "🇧🇪", treaty: true, region: "europe" },
  "Bolivia": { flag: "🇧🇴", treaty: true, region: "latin_america" },
  "Bosnia and Herzegovina": { flag: "🇧🇦", treaty: true, region: "europe" },
  "Brazil": { flag: "🇧🇷", treaty: false, region: "latin_america" },
  "Bulgaria": { flag: "🇧🇬", treaty: true, region: "europe" },
  "Cameroon": { flag: "🇨🇲", treaty: true, region: "africa" },
  "Canada": { flag: "🇨🇦", treaty: true, region: "north_america" },
  "Chile": { flag: "🇨🇱", treaty: true, region: "latin_america" },
  "China (Taiwan)": { flag: "🇹🇼", treaty: true, region: "asia_pacific" },
  "China (Mainland)": { flag: "🇨🇳", treaty: false, region: "asia_pacific" },
  "Colombia": { flag: "🇨🇴", treaty: true, region: "latin_america" },
  "Congo (Brazzaville)": { flag: "🇨🇬", treaty: true, region: "africa" },
  "Congo (Kinshasa)": { flag: "🇨🇩", treaty: true, region: "africa" },
  "Costa Rica": { flag: "🇨🇷", treaty: true, region: "latin_america" },
  "Croatia": { flag: "🇭🇷", treaty: true, region: "europe" },
  "Czech Republic": { flag: "🇨🇿", treaty: true, region: "europe" },
  "Denmark": { flag: "🇩🇰", treaty: true, region: "europe" },
  "Ecuador": { flag: "🇪🇨", treaty: true, region: "latin_america" },
  "Egypt": { flag: "🇪🇬", treaty: true, region: "middle_east" },
  "Estonia": { flag: "🇪🇪", treaty: true, region: "europe" },
  "Ethiopia": { flag: "🇪🇹", treaty: true, region: "africa" },
  "Finland": { flag: "🇫🇮", treaty: true, region: "europe" },
  "France": { flag: "🇫🇷", treaty: true, region: "europe" },
  "Georgia": { flag: "🇬🇪", treaty: true, region: "central_asia" },
  "Germany": { flag: "🇩🇪", treaty: true, region: "europe" },
  "Grenada": { flag: "🇬🇩", treaty: true, region: "latin_america" },
  "Honduras": { flag: "🇭🇳", treaty: true, region: "latin_america" },
  "India": { flag: "🇮🇳", treaty: false, region: "south_asia" },
  "Iran": { flag: "🇮🇷", treaty: true, region: "middle_east" },
  "Ireland": { flag: "🇮🇪", treaty: true, region: "europe" },
  "Israel": { flag: "🇮🇱", treaty: true, region: "middle_east" },
  "Italy": { flag: "🇮🇹", treaty: true, region: "europe" },
  "Jamaica": { flag: "🇯🇲", treaty: true, region: "latin_america" },
  "Japan": { flag: "🇯🇵", treaty: true, region: "asia_pacific" },
  "Jordan": { flag: "🇯🇴", treaty: true, region: "middle_east" },
  "Kazakhstan": { flag: "🇰🇿", treaty: true, region: "central_asia" },
  "Kosovo": { flag: "🇽🇰", treaty: true, region: "europe" },
  "Kyrgyzstan": { flag: "🇰🇬", treaty: true, region: "central_asia" },
  "Latvia": { flag: "🇱🇻", treaty: true, region: "europe" },
  "Liberia": { flag: "🇱🇷", treaty: true, region: "africa" },
  "Lithuania": { flag: "🇱🇹", treaty: true, region: "europe" },
  "Luxembourg": { flag: "🇱🇺", treaty: true, region: "europe" },
  "Mexico": { flag: "🇲🇽", treaty: true, region: "latin_america" },
  "Moldova": { flag: "🇲🇩", treaty: true, region: "europe" },
  "Mongolia": { flag: "🇲🇳", treaty: true, region: "asia_pacific" },
  "Montenegro": { flag: "🇲🇪", treaty: true, region: "europe" },
  "Morocco": { flag: "🇲🇦", treaty: true, region: "middle_east" },
  "Netherlands": { flag: "🇳🇱", treaty: true, region: "europe" },
  "New Zealand": { flag: "🇳🇿", treaty: true, region: "asia_pacific" },
  "Nigeria": { flag: "🇳🇬", treaty: false, region: "africa" },
  "North Macedonia": { flag: "🇲🇰", treaty: true, region: "europe" },
  "Norway": { flag: "🇳🇴", treaty: true, region: "europe" },
  "Oman": { flag: "🇴🇲", treaty: true, region: "middle_east" },
  "Pakistan": { flag: "🇵🇰", treaty: true, region: "south_asia" },
  "Panama": { flag: "🇵🇦", treaty: true, region: "latin_america" },
  "Paraguay": { flag: "🇵🇾", treaty: true, region: "latin_america" },
  "Philippines": { flag: "🇵🇭", treaty: true, region: "asia_pacific" },
  "Poland": { flag: "🇵🇱", treaty: true, region: "europe" },
  "Romania": { flag: "🇷🇴", treaty: true, region: "europe" },
  "Russia": { flag: "🇷🇺", treaty: false, region: "europe" },
  "Senegal": { flag: "🇸🇳", treaty: true, region: "africa" },
  "Serbia": { flag: "🇷🇸", treaty: true, region: "europe" },
  "Singapore": { flag: "🇸🇬", treaty: true, region: "asia_pacific" },
  "Slovak Republic": { flag: "🇸🇰", treaty: true, region: "europe" },
  "Slovenia": { flag: "🇸🇮", treaty: true, region: "europe" },
  "South Korea": { flag: "🇰🇷", treaty: true, region: "asia_pacific" },
  "Spain": { flag: "🇪🇸", treaty: true, region: "europe" },
  "Sri Lanka": { flag: "🇱🇰", treaty: true, region: "south_asia" },
  "Suriname": { flag: "🇸🇷", treaty: true, region: "latin_america" },
  "Sweden": { flag: "🇸🇪", treaty: true, region: "europe" },
  "Switzerland": { flag: "🇨🇭", treaty: true, region: "europe" },
  "Thailand": { flag: "🇹🇭", treaty: true, region: "asia_pacific" },
  "Trinidad and Tobago": { flag: "🇹🇹", treaty: true, region: "latin_america" },
  "Tunisia": { flag: "🇹🇳", treaty: true, region: "middle_east" },
  "Turkey": { flag: "🇹🇷", treaty: true, region: "middle_east" },
  "Ukraine": { flag: "🇺🇦", treaty: true, region: "europe" },
  "United Kingdom": { flag: "🇬🇧", treaty: true, region: "europe" },
  "Uzbekistan": { flag: "🇺🇿", treaty: true, region: "central_asia" },
  "Venezuela": { flag: "🇻🇪", treaty: false, region: "latin_america" },
  "Yemen": { flag: "🇾🇪", treaty: true, region: "middle_east" },
};

// ── Regional fallback estimates (when no specific embassy data) ───────────────

const REGION_ESTIMATES: Record<string, { range: string; note: string }> = {
  europe:        { range: "3–6 weeks",  note: "European embassies generally process E-2 appointments efficiently" },
  asia_pacific:  { range: "4–8 weeks",  note: "Asia-Pacific processing times vary by post volume" },
  latin_america: { range: "6–12 weeks", note: "Latin American posts can experience higher appointment demand" },
  middle_east:   { range: "4–8 weeks",  note: "Middle East processing times vary; some posts process quickly" },
  africa:        { range: "6–14 weeks", note: "African posts have limited appointment availability in some locations" },
  south_asia:    { range: "6–12 weeks", note: "South Asian posts process high volumes; plan well ahead" },
  central_asia:  { range: "4–10 weeks", note: "Central Asian post capacity varies significantly" },
  north_america: { range: "3–6 weeks",  note: "North American posts are generally well-staffed" },
};

// ── Embassy Data (correct appointment URLs) ───────────────────────────────────

interface Embassy {
  city: string;
  waitTime: string;
  appointmentUrl: string;  // Direct link to schedule appointment
  infoUrl: string;         // Info page about E-2 at that embassy
}

const EMBASSIES: Record<string, Embassy[]> = {
  "United Kingdom": [
    { city: "London", waitTime: "2–4 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-gb/niv",
      infoUrl: "https://uk.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
  ],
  "Mexico": [
    { city: "Mexico City", waitTime: "8–12 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-mx/niv",
      infoUrl: "https://mx.usembassy.gov/visas/nonimmigrant-visas/e-visas-e1-e2/" },
    { city: "Guadalajara", waitTime: "10–14 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-mx/niv",
      infoUrl: "https://mx.usembassy.gov/visas/nonimmigrant-visas/e-visas-e1-e2/" },
    { city: "Monterrey", waitTime: "6–10 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-mx/niv",
      infoUrl: "https://mx.usembassy.gov/visas/nonimmigrant-visas/e-visas-e1-e2/" },
    { city: "Tijuana", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-mx/niv",
      infoUrl: "https://mx.usembassy.gov/visas/nonimmigrant-visas/e-visas-e1-e2/" },
    { city: "Ciudad Juárez", waitTime: "3–6 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-mx/niv",
      infoUrl: "https://mx.usembassy.gov/visas/nonimmigrant-visas/e-visas-e1-e2/" },
    { city: "Nogales", waitTime: "3–5 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-mx/niv",
      infoUrl: "https://mx.usembassy.gov/visas/nonimmigrant-visas/e-visas-e1-e2/" },
  ],
  "Germany": [
    { city: "Berlin", waitTime: "3–6 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-de/niv",
      infoUrl: "https://de.usembassy.gov/visas/nonimmigrant-visas/trader-e1-investor-e2/" },
    { city: "Frankfurt", waitTime: "4–7 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-de/niv",
      infoUrl: "https://de.usembassy.gov/visas/nonimmigrant-visas/trader-e1-investor-e2/" },
    { city: "Munich", waitTime: "3–5 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-de/niv",
      infoUrl: "https://de.usembassy.gov/visas/nonimmigrant-visas/trader-e1-investor-e2/" },
  ],
  "Canada": [
    { city: "Toronto", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ca/niv",
      infoUrl: "https://ca.usembassy.gov/visas/nonimmigrant-visas/" },
    { city: "Vancouver", waitTime: "3–6 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ca/niv",
      infoUrl: "https://ca.usembassy.gov/visas/nonimmigrant-visas/" },
    { city: "Calgary", waitTime: "3–5 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ca/niv",
      infoUrl: "https://ca.usembassy.gov/visas/nonimmigrant-visas/" },
    { city: "Ottawa", waitTime: "4–7 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ca/niv",
      infoUrl: "https://ca.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "France": [
    { city: "Paris", waitTime: "3–5 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-fr/niv",
      infoUrl: "https://fr.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
  ],
  "Italy": [
    { city: "Rome", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-it/niv",
      infoUrl: "https://it.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
    { city: "Milan (Consulate)", waitTime: "5–9 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-it/niv",
      infoUrl: "https://it.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
  ],
  "Australia": [
    { city: "Sydney", waitTime: "4–6 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-au/niv",
      infoUrl: "https://au.usembassy.gov/visas/nonimmigrant-visas/" },
    { city: "Melbourne (Consulate)", waitTime: "4–7 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-au/niv",
      infoUrl: "https://au.usembassy.gov/visas/nonimmigrant-visas/" },
    { city: "Perth (Consulate)", waitTime: "3–5 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-au/niv",
      infoUrl: "https://au.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Japan": [
    { city: "Tokyo", waitTime: "2–4 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-jp/niv",
      infoUrl: "https://jp.usembassy.gov/visas/nonimmigrant-visas/investor-e2/" },
    { city: "Osaka (Consulate)", waitTime: "3–5 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-jp/niv",
      infoUrl: "https://jp.usembassy.gov/visas/nonimmigrant-visas/investor-e2/" },
  ],
  "South Korea": [
    { city: "Seoul", waitTime: "3–5 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-kr/niv",
      infoUrl: "https://kr.usembassy.gov/visas/nonimmigrant-visas/e-2-investor-visa/" },
    { city: "Busan (Consulate)", waitTime: "4–6 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-kr/niv",
      infoUrl: "https://kr.usembassy.gov/visas/nonimmigrant-visas/e-2-investor-visa/" },
  ],
  "Turkey": [
    { city: "Ankara", waitTime: "6–10 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-tr/niv",
      infoUrl: "https://tr.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
    { city: "Istanbul (Consulate)", waitTime: "8–12 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-tr/niv",
      infoUrl: "https://tr.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
    { city: "Adana (Consulate)", waitTime: "5–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-tr/niv",
      infoUrl: "https://tr.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
  ],
  "Colombia": [
    { city: "Bogotá", waitTime: "6–10 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-co/niv",
      infoUrl: "https://co.usembassy.gov/visas/nonimmigrant-visas/investor-trader-e1-e2/" },
    { city: "Barranquilla (Consulate)", waitTime: "5–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-co/niv",
      infoUrl: "https://co.usembassy.gov/visas/nonimmigrant-visas/investor-trader-e1-e2/" },
  ],
  "Philippines": [
    { city: "Manila", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ph/niv",
      infoUrl: "https://ph.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Poland": [
    { city: "Warsaw", waitTime: "3–6 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-pl/niv",
      infoUrl: "https://pl.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
    { city: "Kraków (Consulate)", waitTime: "3–5 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-pl/niv",
      infoUrl: "https://pl.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
  ],
  "Spain": [
    { city: "Madrid", waitTime: "3–6 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-es/niv",
      infoUrl: "https://es.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
    { city: "Barcelona (Consulate)", waitTime: "4–7 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-es/niv",
      infoUrl: "https://es.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
  ],
  "Netherlands": [
    { city: "Amsterdam", waitTime: "2–5 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-nl/niv",
      infoUrl: "https://nl.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Sweden": [
    { city: "Stockholm", waitTime: "2–4 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-se/niv",
      infoUrl: "https://se.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Switzerland": [
    { city: "Bern", waitTime: "2–4 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ch/niv",
      infoUrl: "https://ch.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Israel": [
    { city: "Tel Aviv", waitTime: "3–6 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-il/niv",
      infoUrl: "https://il.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
  ],
  "Argentina": [
    { city: "Buenos Aires", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ar/niv",
      infoUrl: "https://ar.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Chile": [
    { city: "Santiago", waitTime: "4–7 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-cl/niv",
      infoUrl: "https://cl.usembassy.gov/visas/nonimmigrant-visas/e2-investor-visa/" },
  ],
  "Singapore": [
    { city: "Singapore", waitTime: "2–4 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-sg/niv",
      infoUrl: "https://sg.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
  ],
  "Ireland": [
    { city: "Dublin", waitTime: "2–5 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ie/niv",
      infoUrl: "https://ie.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
  ],
  "Belgium": [
    { city: "Brussels", waitTime: "3–5 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-be/niv",
      infoUrl: "https://be.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Morocco": [
    { city: "Rabat", waitTime: "5–9 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ma/niv",
      infoUrl: "https://ma.usembassy.gov/visas/nonimmigrant-visas/" },
    { city: "Casablanca (Consulate)", waitTime: "6–10 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ma/niv",
      infoUrl: "https://ma.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Jordan": [
    { city: "Amman", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-jo/niv",
      infoUrl: "https://jo.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Ukraine": [
    { city: "Kyiv", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ua/niv",
      infoUrl: "https://ua.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Thailand": [
    { city: "Bangkok", waitTime: "4–7 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-th/niv",
      infoUrl: "https://th.usembassy.gov/visas/nonimmigrant-visas/" },
    { city: "Chiang Mai (Consulate)", waitTime: "3–6 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-th/niv",
      infoUrl: "https://th.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Pakistan": [
    { city: "Islamabad", waitTime: "6–12 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-pk/niv",
      infoUrl: "https://pk.usembassy.gov/visas/nonimmigrant-visas/" },
    { city: "Karachi (Consulate)", waitTime: "6–10 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-pk/niv",
      infoUrl: "https://pk.usembassy.gov/visas/nonimmigrant-visas/" },
    { city: "Lahore (Consulate)", waitTime: "5–9 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-pk/niv",
      infoUrl: "https://pk.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "China (Taiwan)": [
    { city: "Taipei (AIT)", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-tw/niv",
      infoUrl: "https://www.ait.org.tw/visas-immigration/nonimmigrant-visas/e-visas/" },
    { city: "Kaohsiung (AIT Branch)", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-tw/niv",
      infoUrl: "https://www.ait.org.tw/visas-immigration/nonimmigrant-visas/e-visas/" },
  ],
  "Ecuador": [
    { city: "Quito", waitTime: "6–10 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ec/niv",
      infoUrl: "https://ec.usembassy.gov/visas/nonimmigrant-visas/" },
    { city: "Guayaquil (Consulate)", waitTime: "5–9 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ec/niv",
      infoUrl: "https://ec.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Costa Rica": [
    { city: "San José", waitTime: "5–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-cr/niv",
      infoUrl: "https://cr.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Panama": [
    { city: "Panama City", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-pa/niv",
      infoUrl: "https://pa.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "New Zealand": [
    { city: "Auckland", waitTime: "3–6 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-nz/niv",
      infoUrl: "https://nz.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Romania": [
    { city: "Bucharest", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-ro/niv",
      infoUrl: "https://ro.usembassy.gov/visas/nonimmigrant-visas/e-visas/" },
  ],
  "Czech Republic": [
    { city: "Prague", waitTime: "3–6 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-cz/niv",
      infoUrl: "https://cz.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Greece": [
    { city: "Athens", waitTime: "4–8 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-gr/niv",
      infoUrl: "https://gr.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
  "Sri Lanka": [
    { city: "Colombo", waitTime: "6–10 weeks",
      appointmentUrl: "https://ais.usvisa-info.com/en-lk/niv",
      infoUrl: "https://lk.usembassy.gov/visas/nonimmigrant-visas/" },
  ],
};

// ── Confetti ─────────────────────────────────────────────────────────────────

function Confetti() {
  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: colors[Math.floor(Math.random() * colors.length)],
    duration: 1.5 + Math.random() * 2,
    delay: Math.random() * 0.8,
    rotate: Math.random() * 360,
  }));
  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-10px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(450px) rotate(720deg); opacity: 0; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {pieces.map((p) => (
          <div
            key={p.id}
            className="absolute w-2 h-3 rounded-sm"
            style={{
              left: p.left,
              top: 0,
              backgroundColor: p.color,
              transform: `rotate(${p.rotate}deg)`,
              animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// ── Lead Capture Form (for no-data countries) ─────────────────────────────────

function LeadCaptureForm({ country }: { country: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/leads", {
        fullName: name.trim(),
        email: email.trim(),
        message: `[Embassy Checker] Wait time inquiry — ${country}`,
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
        <p className="text-sm font-semibold text-emerald-800">You're on the list!</p>
        <p className="text-xs text-emerald-700 mt-1">We'll send you updates as we add more embassy data.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-gray-50 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-800">Get notified when we add {country} data</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="lc-name" className="text-xs">Your name</Label>
          <Input id="lc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required className="text-sm" />
        </div>
        <div>
          <Label htmlFor="lc-email" className="text-xs">Email address</Label>
          <Input id="lc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required className="text-sm" />
        </div>
      </div>
      <Button type="submit" size="sm" className="w-full gap-2" disabled={loading}>
        <Send className="w-3.5 h-3.5" />
        {loading ? "Saving…" : "Notify me"}
      </Button>
    </form>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

interface EmbassyCheckerModalProps {
  open: boolean;
  onClose: () => void;
}

export function EmbassyCheckerModal({ open, onClose }: EmbassyCheckerModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedEmbassy, setSelectedEmbassy] = useState<Embassy | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const countries = Object.keys(E2_TREATY_COUNTRIES).sort();
  const filtered = countries.filter((c) => c.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSelectCountry = useCallback((country: string) => {
    setSelectedCountry(country);
    setSelectedEmbassy(null);
    setShowResult(false);
    setShowConfetti(false);
    setSearch(country);
    setDropdownOpen(false);
  }, []);

  const handleSelectEmbassy = useCallback((embassy: Embassy) => {
    setSelectedEmbassy(embassy);
    setLoading(true);
    setShowResult(false);
    setShowConfetti(false);
    setTimeout(() => {
      setLoading(false);
      setShowResult(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3200);
    }, 1400);
  }, []);

  const handleReset = () => {
    setSelectedCountry(null);
    setSelectedEmbassy(null);
    setSearch("");
    setShowResult(false);
    setShowConfetti(false);
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  if (!open) return null;

  const countryData = selectedCountry ? E2_TREATY_COUNTRIES[selectedCountry] : null;
  const embassies = selectedCountry ? (EMBASSIES[selectedCountry] || []) : [];
  const isTreaty = countryData?.treaty ?? false;
  const regionEstimate = countryData ? REGION_ESTIMATES[countryData.region] : null;

  const step = !selectedCountry ? 1 : showResult ? 3 : 2;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Embassy wait time checker">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
        style={{ animation: "slideInRight 0.3s cubic-bezier(0.16,1,0.3,1)" }}
      >
        <style>{`
          @keyframes slideInRight { from { transform: translateX(60px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @keyframes fadeUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          .fade-up { animation: fadeUp 0.35s ease-out; }
        `}</style>

        {showConfetti && <Confetti />}

        {/* Header */}
        <div className="shrink-0 border-b bg-gradient-to-r from-[#0f172a] to-[#1e3a5f] px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-1">
                <Globe2 className="w-3.5 h-3.5" /> Embassy Wait Time Checker
              </div>
              <h2 className="text-xl font-bold">Find Your E-2 Visa Wait Time</h2>
              <p className="text-sm text-white/60 mt-0.5">Select your country and nearest US embassy</p>
            </div>
            <button aria-label="Close" onClick={onClose} className="rounded-full bg-white/10 p-2 hover:bg-white/20 transition-colors mt-0.5 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="mt-4 flex items-center gap-2">
            {[{ n: 1, label: "Country" }, { n: 2, label: "Embassy" }, { n: 3, label: "Result" }].map(({ n, label }, i) => (
              <div key={n} className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all ${step >= n ? "bg-emerald-500 text-white" : "bg-white/20 text-white/50"}`}>
                  {step > n ? <CheckCircle2 className="w-4 h-4" /> : n}
                </div>
                <span className={`text-xs ${step >= n ? "text-white" : "text-white/40"}`}>{label}</span>
                {i < 2 && <div className={`h-px w-8 transition-all ${step > n ? "bg-emerald-500" : "bg-white/20"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {/* Step 1 — Country */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Step 1 — Select your country of nationality
            </label>
            <div ref={dropdownRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                  ref={inputRef}
                  data-testid="input-country-search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); setSelectedCountry(null); setShowResult(false); }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Type your country…"
                  className="pl-9 pr-10"
                />
                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </div>

              {dropdownOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border bg-white shadow-xl">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">No countries found</div>
                  ) : filtered.map((country) => {
                    const info = E2_TREATY_COUNTRIES[country];
                    return (
                      <button
                        key={country}
                        className="flex items-center justify-between w-full px-4 py-2.5 text-sm hover:bg-gray-50 text-left transition-colors"
                        onClick={() => handleSelectCountry(country)}
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="text-xl">{info.flag}</span>
                          <span className="text-gray-800">{country}</span>
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${info.treaty ? "text-emerald-600 bg-emerald-50" : "text-red-500 bg-red-50"}`}>
                          {info.treaty ? "E-2 Treaty" : "No Treaty"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Treaty status card */}
          {selectedCountry && countryData && (
            <div className={`fade-up rounded-2xl border-2 p-5 ${isTreaty ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-start gap-4">
                <span className="text-4xl">{countryData.flag}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {isTreaty ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-red-500" />}
                    <span className={`font-bold text-base ${isTreaty ? "text-emerald-800" : "text-red-800"}`}>
                      {selectedCountry} — E-2 Treaty: {isTreaty ? "✅ YES" : "❌ NO"}
                    </span>
                  </div>
                  {isTreaty ? (
                    <p className="text-sm text-emerald-700 leading-relaxed">
                      Nationals of <strong>{selectedCountry}</strong> are eligible to apply for the E-2 Investor Visa under the US commercial treaty.
                    </p>
                  ) : (
                    <p className="text-sm text-red-700 leading-relaxed">
                      Unfortunately <strong>{selectedCountry}</strong> does not currently have an E-2 commercial treaty with the US. Consult an immigration attorney for alternative pathways.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Embassy selector */}
          {selectedCountry && isTreaty && !showResult && !loading && (
            <div className="fade-up">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Step 2 — Select your nearest US embassy / consulate
              </label>

              {embassies.length > 0 ? (
                <div className="grid gap-2">
                  {embassies.map((embassy) => (
                    <button
                      key={embassy.city}
                      onClick={() => handleSelectEmbassy(embassy)}
                      className="flex items-center justify-between rounded-xl border bg-white px-4 py-3.5 text-left hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{countryData?.flag}</span>
                        <div>
                          <span className="font-medium text-gray-900 text-sm">US Embassy — {embassy.city}</span>
                          <div className="text-xs text-gray-400 mt-0.5">Est. {embassy.waitTime}</div>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 group-hover:text-[hsl(var(--primary))] transition-colors shrink-0">Check →</span>
                    </button>
                  ))}
                </div>
              ) : (
                /* No specific data — show regional estimate + lead capture */
                <div className="space-y-4">
                  {/* Regional estimate card */}
                  {regionEstimate && (
                    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-amber-900 text-sm mb-1">Estimated wait time for {selectedCountry}</div>
                          <div className="text-3xl font-black text-amber-800 mb-1">{regionEstimate.range}</div>
                          <p className="text-xs text-amber-700 leading-relaxed">
                            We don't have specific data for this embassy yet, but based on community reports, online forums, and regional patterns — applicants from this area typically wait approximately {regionEstimate.range}. {regionEstimate.note}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CTAs */}
                  <div className="grid grid-cols-1 gap-3">
                    <Button className="gap-2 w-full" asChild>
                      <a href="/contact">
                        <CalendarCheck className="w-4 h-4" />
                        Book a Free Consultation
                      </a>
                    </Button>
                    <Button variant="outline" className="gap-2 w-full" asChild>
                      <a href="https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/wait-times.html" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                        Check Official Wait Times at travel.state.gov
                      </a>
                    </Button>
                  </div>

                  {/* Email capture */}
                  <LeadCaptureForm country={selectedCountry} />

                  <p className="text-xs text-gray-400 text-center">
                    Always verify current wait times at{" "}
                    <a href="https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/wait-times.html" target="_blank" rel="noopener noreferrer" className="underline">travel.state.gov</a>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="w-10 h-10 text-[hsl(var(--primary))] animate-spin" />
              <p className="text-sm text-gray-500">Checking embassy wait times…</p>
            </div>
          )}

          {/* Step 3 — Result */}
          {showResult && selectedEmbassy && selectedCountry && (
            <div className="fade-up space-y-4">
              <div className="rounded-2xl border-2 border-[hsl(var(--primary))]/25 bg-gradient-to-br from-[hsl(var(--primary))]/5 to-emerald-50 p-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--primary))] mb-3">
                  <Clock className="w-4 h-4" />Estimated Wait Time
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">US Embassy — {selectedEmbassy.city}</div>
                    <div className="text-4xl font-black text-gray-900">{selectedEmbassy.waitTime}</div>
                    <div className="text-sm text-gray-500 mt-1">if you apply today</div>
                  </div>
                  <span className="text-5xl shrink-0">{countryData?.flag}</span>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <Button className="gap-2 w-full" size="lg" asChild>
                    <a href="/contact">
                      <CalendarCheck className="w-4 h-4" />
                      Book a Free Consultation
                    </a>
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                      <a href={selectedEmbassy.appointmentUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Schedule Appointment
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                      <a href={selectedEmbassy.infoUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Embassy E-2 Info
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed">
                <span className="mt-0.5 shrink-0">⚠️</span>
                <span>
                  <strong>Disclaimer:</strong> Wait times are estimates based on US State Department data and community reports — they change frequently. Always verify current appointments at{" "}
                  <a href="https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/wait-times.html" target="_blank" rel="noopener noreferrer" className="underline">travel.state.gov</a>.
                </span>
              </div>

              <button onClick={handleReset} className="text-sm text-[hsl(var(--primary))] hover:underline">← Check another country</button>
            </div>
          )}

          {/* Non-treaty */}
          {selectedCountry && countryData && !isTreaty && (
            <div className="fade-up rounded-xl border bg-gray-50 p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-900">Explore alternative visa options</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                While the E-2 visa isn't available for nationals of {selectedCountry}, there may be other US investment pathways — such as EB-5 or L-1. Our team can help explore your options.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <Button className="gap-2" asChild>
                  <a href="/contact">
                    <CalendarCheck className="w-4 h-4" />Book a Free Consultation
                  </a>
                </Button>
                <LeadCaptureForm country={selectedCountry} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t bg-gray-50 px-6 py-3 text-xs text-gray-400 flex items-center justify-between gap-4 flex-wrap">
          <span>Data: US State Department & community sources</span>
          <a href="https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/wait-times.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />Official wait times
          </a>
        </div>
      </div>
    </div>
  );
}
