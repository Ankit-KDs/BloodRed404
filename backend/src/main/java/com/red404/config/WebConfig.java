package com.red404.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Serve static files (HTML, CSS, JS) from the classpath static folder
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/");
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // Default welcome page
        registry.addViewController("/").setViewName("forward:/index.html");

        // Route aliases and canonical redirects
        registry.addViewController("/public-search.html").setViewName("forward:/blood-availability-search.html");
        registry.addViewController("/public-search").setViewName("forward:/blood-availability-search.html");
        registry.addViewController("/eligibility.html").setViewName("forward:/eligibility-checker.html");
        registry.addViewController("/who-can-donate.html").setViewName("forward:/eligibility-checker.html");
        registry.addViewController("/eligibility").setViewName("forward:/eligibility-checker.html");
        registry.addViewController("/privacy.html").setViewName("forward:/privacy-policy.html");
        registry.addViewController("/privacy").setViewName("forward:/privacy-policy.html");
        registry.addViewController("/contact.html").setViewName("redirect:/index.html#contact");
        registry.addViewController("/contact").setViewName("redirect:/index.html#contact");
    }
}

