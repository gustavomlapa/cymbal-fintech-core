# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN go mod download || true

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/core-banking-server ./cmd/server/main.go

# Runtime stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/core-banking-server /app/core-banking-server

ENV PORT=8081
EXPOSE 8081

ENTRYPOINT ["/app/core-banking-server"]

