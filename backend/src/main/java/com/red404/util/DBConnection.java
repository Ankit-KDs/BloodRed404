package com.red404.util;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

@Component
public class DBConnection {

    private static DataSource dataSource;

    @Autowired
    public void setDataSource(DataSource ds) {
        DBConnection.dataSource = ds;
    }

    public static Connection getConnection() throws SQLException {
        if (dataSource == null) {
            throw new SQLException("DataSource not initialized — Spring context may not be ready.");
        }
        return dataSource.getConnection();
    }
}
