package de.volkerw.hsma.mmi;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public class Schedule {
    private static final Map<String, String[]> BLOCK_TIMES = new LinkedHashMap<String, String[]>() {{
        put("1", new String[]{"8:00", "9:30"});
        put("2", new String[]{"9:45", "11:15"});
        put("3", new String[]{"12:00", "13:30"});
        put("4", new String[]{"13:40", "15:10"});
        put("5", new String[]{"15:20", "16:50"});
        put("6", new String[]{"17:00", "18:30"});
    }};

    private static final Map<String, String> DAYS = new LinkedHashMap<String, String>() {{
        put("MO", "Montag");
        put("DI", "Dienstag");
        put("MI", "Mittwoch");
        put("DO", "Donnerstag");
        put("FR", "Freitag");
    }};

    static Set<ScheduleEntry> resolveScheduleEntries(String scheduleUri) {
        Set<ScheduleEntry> entries = new LinkedHashSet<>();
        try {
            Document doc = Jsoup.connect(scheduleUri).get();
            // erster Vorlesungsblock ist tr:nth-child(2)
            for (int i = 2; i < 8; i++) // iterates through blocks
            {
                // tr:nth-child(2) ist erster Block, 3 zweiter, usw.
                Elements elements = doc.select(String.format("body > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(%s) > td", i));
                // first element is block number
                String block = "" + elements.get(0).text().charAt(1);
                for (int column = 1; column < elements.size(); column++) // erstes column ist der Block -> 01
                {
                    Element e = elements.get(column);
                    String day = DAYS.get(doc.select(String.format("body > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(1) > th:nth-child(%s)", column + 1)).first().text());

                    if (e.select("span").size() > 0) // block leer?
                    {
                        int moduleCount = e.select("br").size() > 0 ? e.select("br").size() + 1 : 1;
                        for (int j = 0; j < moduleCount; j++) {
                            // hier erst ab zweitem Element
                            ScheduleEntry scheduleEntry = new ScheduleEntry();
                            // Modul
                            Element element = e.select(String.format("span:nth-child(%s)", j * 3 + j + 1)).first();
                            scheduleEntry.module = element.text();
                            scheduleEntry.moduleFull = element.attr("title");
                            // Ort
                            element = e.select(String.format("span:nth-child(%s)", j * 3 + j + 2)).first();
                            scheduleEntry.location = element.text();
                            scheduleEntry.locationFull = element.attr("title");
                            // Prof
                            element = e.select(String.format("span:nth-child(%s)", j * 3 + j + 3)).first();
                            scheduleEntry.professor = element.text();
                            scheduleEntry.professorFull = element.attr("title");

                            scheduleEntry.block = block;
                            scheduleEntry.block_start = BLOCK_TIMES.get(block)[0];
                            scheduleEntry.block_end = BLOCK_TIMES.get(block)[1];
                            scheduleEntry.day = day;
                            entries.add(scheduleEntry);
                        }
                    }
                }
            }

        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        return entries;
    }
}
