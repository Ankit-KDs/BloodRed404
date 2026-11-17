package com.red404;

import com.red404.config.EnvConfig;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Red404Application {

    public static void main(String[] args) {
        // Part 8: Fail startup with a clear message if required environment variables are missing
        EnvConfig.validateOnStartup();
        SpringApplication.run(Red404Application.class, args);
    }
}
