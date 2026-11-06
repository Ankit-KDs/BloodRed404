# Multi-stage Docker build for RED404 Spring Boot Application
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy project files
COPY . .

# Package the executable JAR
RUN mvn clean package -DskipTests -f backend/pom.xml

# Lightweight JRE runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy built JAR
COPY --from=build /app/backend/target/RED404.jar app.jar

# Cloud providers inject $PORT dynamically
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-Dserver.port=${PORT}", "-jar", "app.jar"]

