package de.volkerw.hsma.mmi;

import java.util.HashMap;
import java.util.Map;

class ScheduleEntry {
    String module;
    String moduleFull;
    String location;
    String locationFull;
    String professor;
    String professorFull;
    String block;
    String block_start;
    String block_end;
    String day;

    @Override
    public String toString() {
        return "ScheduleEntry{" +
                "module='" + module + '\'' +
                ", moduleFull='" + moduleFull + '\'' +
                ", location='" + location + '\'' +
                ", locationFull='" + locationFull + '\'' +
                ", professor='" + professor + '\'' +
                ", professorFull='" + professorFull + '\'' +
                ", block='" + block + '\'' +
                ", block_start='" + block_start + '\'' +
                ", block_end='" + block_end + '\'' +
                ", day='" + day + '\'' +
                '}';
    }

    public Map<String, String> asMap() {
        Map<String, String> asMap = new HashMap<>();
        asMap.put("block", block);
        asMap.put("block_start", block_start);
        asMap.put("block_end", block_end);
        asMap.put("professor", professor);
        asMap.put("professor_full", professorFull);
        asMap.put("module", module);
        asMap.put("module_full", moduleFull);
        asMap.put("location", location);
        asMap.put("location_full", locationFull);
        asMap.put("day", day);
        return asMap;
    }

    public String key() {
        return String.format("%s_%s_%s_%s_%s", day, block, module, location, professor);
    }
}
