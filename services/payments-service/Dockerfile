FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PORT=8083

COPY requirements.txt ./
# Install requirements if dependencies needed, fallback gracefully
RUN pip install --no-cache-dir -r requirements.txt || true

COPY . .

EXPOSE 8083

CMD ["python", "main.py"]

