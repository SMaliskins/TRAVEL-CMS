import os
from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI
from crewai_tools import FileWriterTool, FileReadTool, DirectoryReadTool

load_dotenv(dotenv_path=".env.local")

# Модель с запасом по ретраям
llm = ChatOpenAI(model='gpt-4o-mini', temperature=0, max_retries=10)

file_writer = FileWriterTool()
file_reader = FileReadTool()

# ОГРАНИЧИВАЕМ СКАНЕР: Смотрим только в папку app, игнорируя мусор
dir_reader = DirectoryReadTool(directory='app') 

# --- АГЕНТЫ ---

architect = Agent(
    role='System Architect',
    goal='Найти причину 404 для поставщиков, изучив ТОЛЬКО папку app/api.',
    backstory="""Ты Senior Architect. Твой проект очень большой, поэтому ты не смотришь 
    на все файлы сразу. Ты фокусируешься только на папке 'app/api/directory' 
    и 'app/directory'. Твоя цель — найти файл роута и понять логику Supabase.""",
    llm=llm,
    tools=[dir_reader, file_reader],
    verbose=True
)

engineer = Agent(
    role='Fullstack Developer',
    goal='Исправить SQL-запрос в API роуте.',
    backstory="""Ты Senior Developer. Ты работаешь точечно. Ты получаешь путь к файлу 
    от Архитектора, читаешь его и правишь. Ты не сканируешь весь проект, 
    чтобы не тратить лимиты API.""",
    llm=llm,
    tools=[file_writer, file_reader], # Убрали сканер у инженера, чтобы он не спамил запросами
    max_iter=10,
    verbose=True
)

critic = Agent(
    role='QA Engineer',
    goal='Проверить финальный код.',
    backstory="""Ты проверяешь только те файлы, которые изменил Инженер.""",
    llm=llm,
    tools=[file_reader],
    verbose=True
)

# --- ЗАДАЧИ ---

def run_focused_repair():
    print(f"\n🚀 ЗАПУСК ФОКУСИРОВАННОЙ ПОЧИНКИ (Экономим токены)...\n")

    task_analyze = Task(
        description="""
        1. Используй DirectoryReadTool, чтобы увидеть файлы ТОЛЬКО в 'api/directory/[id]'.
        2. Найди файл route.ts.
        3. Прочитай его и найди условие, которое фильтрует 'supplier'.
        """,
        agent=architect,
        expected_output="Точный код фильтрации и путь к файлу."
    )

    task_fix = Task(
        description="""
        1. Открой файл, путь к которому нашел Архитектор.
        2. Удали фильтр по роли, чтобы подгружались и клиенты, и поставщики.
        3. Сохрани файл.
        """,
        agent=engineer,
        expected_output="Исправленный API роут."
    )

    task_verify = Task(
        description="Прочитай исправленный файл и подтверди SCORE: 10/10.",
        agent=critic,
        expected_output="Финальный отчет."
    )

    crew = Crew(
        agents=[architect, engineer, critic],
        tasks=[task_analyze, task_fix, task_verify],
        process=Process.sequential
    )

    print(crew.kickoff())

if __name__ == "__main__":
    run_focused_repair()