import sqlite3

def check_database_structure():
    conn = sqlite3.connect('ops_platform.db')
    cursor = conn.cursor()
    
    print('Dashboards table structure:')
    cursor.execute('PRAGMA table_info(dashboards)')
    for row in cursor.fetchall():
        print(row)
    
    print('\nVariables table structure:')
    cursor.execute('PRAGMA table_info(variables)')
    for row in cursor.fetchall():
        print(row)
    
    print('\nDashboards data:')
    try:
        cursor.execute("SELECT COUNT(*) FROM dashboards")
        count = cursor.fetchone()[0]
        print(f"仪表板数量: {count}")
        
        cursor.execute("SELECT id, title, panels FROM dashboards LIMIT 3")
        dashboards = cursor.fetchall()
        for dashboard in dashboards:
            panels_preview = dashboard[2][:200] if dashboard[2] else 'None'
            print(f"ID: {dashboard[0]}, Title: {dashboard[1]}")
            print(f"Panels preview: {panels_preview}...")
            print("---")
    except sqlite3.Error as e:
        print(f"查询仪表板数据失败: {e}")
    
    print('\nVariables data:')
    cursor.execute('SELECT id, name, type, value FROM variables LIMIT 5')
    for row in cursor.fetchall():
        print(f"ID: {row[0]}, Name: {row[1]}, Type: {row[2]}, Value: {row[3]}")
    
    conn.close()

if __name__ == '__main__':
    check_database_structure()