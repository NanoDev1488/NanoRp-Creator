cmake_minimum_required(VERSION 3.15)
project(nano_rp_cpp_engine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(MSVC)
    add_compile_options(/O2 /GL /W4 /utf-8 /D_CRT_SECURE_NO_WARNINGS)
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} /LTCG")
else()
    add_compile_options(-O3 -Wall -Wextra -pedantic -fvisibility=hidden)
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s")
endif()

add_executable(nano-rp-cpp-engine src/main.cpp)
