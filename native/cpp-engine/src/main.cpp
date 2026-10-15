#include <iostream>
#include <string>
#include <vector>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <cctype>

namespace fs = std::filesystem;

void print_usage() {
    std::cout << "{\"engine\":\"NanoRp-Cpp-Engine\",\"version\":\"1.0.0\",\"commands\":[\"validate-pack\",\"generate-meta\",\"generate-font\",\"generate-override\"]}\n";
}

std::string escape_json(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else o << c;
    }
    return o.str();
}

bool is_valid_minecraft_path(const std::string& path_str) {
    for (char c : path_str) {
        if (c >= 'A' && c <= 'Z') return false; // Minecraft strictly forbids uppercase
        if (c == ' ') return false;
    }
    return true;
}

void validate_pack(const std::string& dir_str) {
    fs::path root(dir_str);
    if (!fs::exists(root) || !fs::is_directory(root)) {
        std::cout << "{\"error\":\"Directory not found: " << escape_json(dir_str) << "\"}\n";
        return;
    }

    bool has_meta = fs::exists(root / "pack.mcmeta");
    bool has_icon = fs::exists(root / "pack.png");
    bool has_assets = fs::exists(root / "assets" / "minecraft");

    std::vector<std::string> invalid_paths;
    size_t file_count = 0;

    for (const auto& entry : fs::recursive_directory_iterator(root)) {
        if (entry.is_regular_file()) {
            file_count++;
            auto rel = fs::relative(entry.path(), root).generic_string();
            if (!is_valid_minecraft_path(rel)) {
                invalid_paths.push_back(rel);
            }
        }
    }

    std::cout << "{\"success\":true,\"has_meta\":" << (has_meta ? "true" : "false")
              << ",\"has_icon\":" << (has_icon ? "true" : "false")
              << ",\"has_assets\":" << (has_assets ? "true" : "false")
              << ",\"total_files\":" << file_count
              << ",\"invalid_paths_count\":" << invalid_paths.size()
              << ",\"invalid_paths\":[";
    for (size_t i = 0; i < invalid_paths.size(); ++i) {
        if (i > 0) std::cout << ",";
        std::cout << "\"" << escape_json(invalid_paths[i]) << "\"";
    }
    std::cout << "]}\n";
}

void generate_meta(const std::string& out_path_str, int pack_format, const std::string& desc) {
    fs::path out_path(out_path_str);
    if (out_path.has_parent_path()) {
        fs::create_directories(out_path.parent_path());
    }

    std::ofstream out(out_path);
    if (!out.is_open()) {
        std::cout << "{\"error\":\"Failed to open file for write: " << escape_json(out_path_str) << "\"}\n";
        return;
    }

    out << "{\n";
    out << "  \"pack\": {\n";
    out << "    \"pack_format\": " << pack_format << ",\n";
    out << "    \"description\": \"" << escape_json(desc) << "\"\n";
    out << "  }\n";
    out << "}\n";
    out.close();

    std::cout << "{\"success\":true,\"path\":\"" << escape_json(out_path_str) << "\",\"pack_format\":" << pack_format << "}\n";
}

void generate_font(const std::string& out_path_str, const std::string& char_symbol, const std::string& texture_path, int height, int ascent) {
    fs::path out_path(out_path_str);
    if (out_path.has_parent_path()) {
        fs::create_directories(out_path.parent_path());
    }

    std::ofstream out(out_path);
    if (!out.is_open()) {
        std::cout << "{\"error\":\"Failed to open font file: " << escape_json(out_path_str) << "\"}\n";
        return;
    }

    out << "{\n";
    out << "  \"providers\": [\n";
    out << "    {\n";
    out << "      \"type\": \"bitmap\",\n";
    out << "      \"file\": \"" << escape_json(texture_path) << "\",\n";
    out << "      \"ascent\": " << ascent << ",\n";
    out << "      \"height\": " << height << ",\n";
    out << "      \"chars\": [\n";
    out << "        \"" << escape_json(char_symbol) << "\"\n";
    out << "      ]\n";
    out << "    }\n";
    out << "  ]\n";
    out << "}\n";
    out.close();

    std::cout << "{\"success\":true,\"path\":\"" << escape_json(out_path_str) << "\"}\n";
}

void generate_override(const std::string& out_path_str, const std::string& item_name, int custom_model_data, const std::string& custom_model_path) {
    fs::path out_path(out_path_str);
    if (out_path.has_parent_path()) {
        fs::create_directories(out_path.parent_path());
    }

    std::ofstream out(out_path);
    if (!out.is_open()) {
        std::cout << "{\"error\":\"Failed to open override file: " << escape_json(out_path_str) << "\"}\n";
        return;
    }

    out << "{\n";
    out << "  \"parent\": \"minecraft:item/handheld\",\n";
    out << "  \"textures\": {\n";
    out << "    \"layer0\": \"minecraft:item/" << escape_json(item_name) << "\"\n";
    out << "  },\n";
    out << "  \"overrides\": [\n";
    out << "    {\n";
    out << "      \"predicate\": {\n";
    out << "        \"custom_model_data\": " << custom_model_data << "\n";
    out << "      },\n";
    out << "      \"model\": \"" << escape_json(custom_model_path) << "\"\n";
    out << "    }\n";
    out << "  ]\n";
    out << "}\n";
    out.close();

    std::cout << "{\"success\":true,\"path\":\"" << escape_json(out_path_str) << "\"}\n";
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        print_usage();
        return 1;
    }

    std::string cmd = argv[1];

    if (cmd == "validate-pack" && argc >= 3) {
        validate_pack(argv[2]);
    } else if (cmd == "generate-meta" && argc >= 5) {
        int format = std::stoi(argv[3]);
        generate_meta(argv[2], format, argv[4]);
    } else if (cmd == "generate-font" && argc >= 7) {
        int height = std::stoi(argv[5]);
        int ascent = std::stoi(argv[6]);
        generate_font(argv[2], argv[3], argv[4], height, ascent);
    } else if (cmd == "generate-override" && argc >= 6) {
        int cmd_data = std::stoi(argv[4]);
        generate_override(argv[2], argv[3], cmd_data, argv[5]);
    } else {
        print_usage();
        return 1;
    }

    return 0;
}
