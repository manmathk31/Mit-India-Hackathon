FROM ubuntu:22.04

# Avoid tzdata prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies for Python and Java
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-venv \
    python3-pip \
    wget \
    curl \
    git \
    tesseract-ocr \
    maven \
    && rm -rf /var/lib/apt/lists/*

# Install Java 21 (Eclipse Temurin)
RUN wget -O - https://packages.adoptium.net/artifactory/api/gpg/key/public | apt-key add - \
    && echo "deb https://packages.adoptium.net/artifactory/deb jammy main" > /etc/apt/sources.list.d/adoptium.list \
    && apt-get update \
    && apt-get install -y temurin-21-jdk \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"

WORKDIR /app

# Copy the entire project
COPY . /app/

# Build Java App
RUN cd cost-agent-spring-ai && mvn clean package -DskipTests

# Install Python requirements
RUN pip3 install --no-cache-dir --upgrade pip
RUN pip3 install --no-cache-dir -r orchestrator/requirements.txt
RUN pip3 install --no-cache-dir -r document_agent/requirements.txt
RUN pip3 install --no-cache-dir -r image_agent/requirements.txt

# Create start script and make it executable
RUN chmod +x /app/start.sh

# Expose the port (Render will inject $PORT)
EXPOSE 10000

# Run the unified start script
CMD ["/app/start.sh"]
