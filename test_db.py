import psycopg2; conn = psycopg2.connect(host="localhost", port=5432, dbname="heatsight_dev", user="postgres", password="postgres"); cursor = conn.cursor(); cursor.execute("SELECT 1"); print(cursor.fetchone()); cursor.close(); conn.close(); print("连接成功")
